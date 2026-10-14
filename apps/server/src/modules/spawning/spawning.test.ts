import {
  baseContent,
  CONFIG,
  type GameConfig,
  inSafeZone,
  isLit,
  LAYER,
  loadContent,
  TIME,
} from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { WorldClock } from '../../core/clock';
import { damage } from '../../core/damage';
import type { ServerEvents } from '../../core/events';
import type { ServerContext } from '../../core/module';
import { safeZoneOf } from '../../core/safeZone';
import { createTestContext } from '../../core/testing';
import { World } from '../../world/World';
import { inventoryModule } from '../inventory';
import { playersModule } from '../players';
import { spawningModule } from './index';

const content = loadContent(baseContent);
const SIZE = 160;
/** Deep in the night of the first day. */
const NIGHT_MS = TIME.daytimeMs + TIME.twilightMs + 60_000;
/** Middle of the first day. */
const DAY_MS = TIME.daytimeMs / 2;
/** Ticks of one spawning round. */
const ROUND_TICKS = CONFIG.monsters.spawnIntervalMs / 50;

/** A small safe zone, for the small test world. */
const baseConfig: GameConfig = {
  ...CONFIG,
  world: { ...CONFIG.world, safeZoneRadiusTiles: 10 },
};

function setup(options: { timeMs: number; monsters?: Partial<GameConfig['monsters']> }) {
  const world = World.generate({ seed: 2, content, layerSizeTiles: SIZE });
  // A flat meadow, with a band of water and a band of torches.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      world.setTile(0, x, y, 'ground', x >= 120 && x < 126 ? 'base:shallow_water' : 'base:grass');
      world.setTile(0, x, y, 'floor', null);
      world.setTile(0, x, y, 'object', y < 50 && x % 4 === 0 && y % 4 === 0 ? 'base:torch' : null);
    }
  }
  const config = { ...baseConfig, monsters: { ...baseConfig.monsters, ...options.monsters } };
  const test = createTestContext({
    config,
    world,
    clock: new WorldClock(options.timeMs),
    modules: [playersModule, inventoryModule, spawningModule],
  });
  let nextPlayerId = 1;
  const addPlayer = (x: number, y: number) =>
    test.ctx.entities.create('player', {
      position: { layer: LAYER.surface, x, y },
      player: { name: `P${nextPlayerId}`, playerId: nextPlayerId++ },
    });
  const monsters = () => test.ctx.entities.query('monster');
  return { ...test, addPlayer, monsters };
}

const positionOf = (ctx: ServerContext, entity: number) => {
  const position = ctx.entities.get(entity, 'position');
  if (!position) {
    throw new Error(`no position for ${entity}`);
  }
  return position;
};

describe('spawning module', () => {
  it('brings monsters at night around a player: in the ring, out of the safe zone, water and light', () => {
    const { ctx, tick, addPlayer, monsters } = setup({ timeMs: NIGHT_MS });
    // Close enough to the spawn for the ring to cover the safe zone, the water and the torches.
    const player = addPlayer(ctx.world.spawn.x + 26, ctx.world.spawn.y - 10);
    const at = positionOf(ctx, player);

    tick(ROUND_TICKS * 30);

    expect(monsters()).toHaveLength(CONFIG.monsters.maxPerPlayer);
    const lightWorld = { objectAt: (x: number, y: number) => ctx.world.getTile(0, x, y, 'object') };
    for (const monster of monsters()) {
      const { x, y } = positionOf(ctx, monster);
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      const distance = Math.hypot(x - at.x, y - at.y);
      expect(distance).toBeGreaterThanOrEqual(CONFIG.monsters.spawnMinDistanceTiles - 1);
      expect(distance).toBeLessThanOrEqual(CONFIG.monsters.spawnMaxDistanceTiles + 1);
      expect(inSafeZone(safeZoneOf(ctx), 0, tx, ty)).toBe(false);
      expect(ctx.world.getTile(0, tx, ty, 'ground')?.water).toBeFalsy();
      expect(isLit(lightWorld, tx, ty, ctx.clock.timeMs)).toBe(false);
      expect(ctx.entities.get(monster, 'health')).toBe(
        content.creatures.require(ctx.entities.get(monster, 'monster')?.creature ?? '').hp,
      );
    }
  });

  it('brings none by day, nor around a dead player', () => {
    const day = setup({ timeMs: DAY_MS });
    day.addPlayer(30.5, 120.5);
    day.tick(ROUND_TICKS * 5);
    expect(day.monsters()).toEqual([]);

    const night = setup({ timeMs: NIGHT_MS });
    const dead = night.addPlayer(30.5, 120.5);
    night.ctx.entities.set(dead, 'dead', 'hit');
    night.tick(ROUND_TICKS * 5);
    expect(night.monsters()).toEqual([]);
  });

  it('stops at the cap of the world, whatever the number of players', () => {
    const { tick, addPlayer, monsters } = setup({ timeMs: NIGHT_MS, monsters: { maxTotal: 4 } });
    addPlayer(30.5, 90.5);
    addPlayer(30.5, 150.5);
    addPlayer(150.5, 90.5);

    tick(ROUND_TICKS * 10);

    expect(monsters()).toHaveLength(4);
  });

  it('makes monsters vanish during the dawn, as many as the dawn share says', () => {
    const all = setup({ timeMs: NIGHT_MS, monsters: { dawnDespawnFraction: 1 } });
    all.addPlayer(30.5, 120.5);
    all.tick(ROUND_TICKS * 10);
    expect(all.monsters().length).toBeGreaterThan(0);

    // The next dawn: picked at its start, gone by its end.
    all.ctx.clock.timeMs = TIME.dayLengthMs + 1000;
    all.tick(ROUND_TICKS);
    all.ctx.clock.timeMs = TIME.dayLengthMs + TIME.twilightMs;
    all.tick(ROUND_TICKS);
    expect(all.monsters()).toEqual([]);

    const none = setup({ timeMs: NIGHT_MS, monsters: { dawnDespawnFraction: 0 } });
    none.addPlayer(30.5, 120.5);
    none.tick(ROUND_TICKS * 10);
    const count = none.monsters().length;
    none.ctx.clock.timeMs = TIME.dayLengthMs + TIME.twilightMs;
    none.tick(ROUND_TICKS * 3);
    expect(none.monsters()).toHaveLength(count);
  });

  it('makes a monster left far from every player vanish after a while', () => {
    const { ctx, tick, addPlayer, monsters } = setup({ timeMs: DAY_MS });
    addPlayer(10.5, 150.5);
    const near = ctx.entities.create('monster', {
      position: { layer: 0, x: 40.5, y: 150.5 },
      monster: { creature: 'base:slime' },
    });
    const far = ctx.entities.create('monster', {
      position: { layer: 0, x: 80.5, y: 150.5 },
      monster: { creature: 'base:slime' },
    });

    tick(ctx.scheduler.ticksFor(CONFIG.monsters.farDespawnDelayMs - 5000));
    expect(monsters()).toEqual([near, far]);
    tick(ctx.scheduler.ticksFor(10_000));
    expect(monsters()).toEqual([near]);
  });

  it('drops the gold and the item of a dead monster where it died, and removes it', () => {
    const { ctx, tick } = setup({ timeMs: DAY_MS });
    const drops: ServerEvents['items.drop'][] = [];
    ctx.events.on('items.drop', (event) => drops.push(event));
    const position = { layer: 0, x: 60.5, y: 140.5 };
    const slime = ctx.entities.create('monster', {
      position,
      health: 6,
      monster: { creature: 'base:slime' },
    });

    damage(ctx, slime, 6, { cause: 'hit' });

    expect(drops).toHaveLength(1);
    expect(drops[0]?.position).toEqual(position);
    const gold = drops[0]?.items.find((stack) => stack.item === 'base:gold');
    expect(gold?.count).toBeGreaterThanOrEqual(1);
    expect(gold?.count).toBeLessThanOrEqual(3);
    expect(drops[0]?.items).toContainEqual({ item: 'base:slime_gel', count: 1 });
    tick();
    expect(ctx.entities.exists(slime)).toBe(false);
    expect(ctx.entities.query('groundItem').length).toBe(2);
  });
});
