import { baseContent, CONFIG, type GameConfig, LAYER, loadContent, TIME } from '@8box/shared';
import { describe, expect, it } from 'vitest';
import { WorldClock } from '../../core/clock';
import type { ServerEvents } from '../../core/events';
import { createTestContext } from '../../core/testing';
import { World } from '../../world/World';
import { harvestModule } from '../harvest';
import { inventoryModule } from '../inventory';
import { playersModule } from '../players';
import { spawningModule } from '../spawning';
import { aiModule, facingToward } from './index';

const content = loadContent(baseContent);
/** A small safe zone, for the small test world (around tile 32). */
const config: GameConfig = { ...CONFIG, world: { ...CONFIG.world, safeZoneRadiusTiles: 4 } };
const PROWLER = content.creatures.require('base:prowler');

function setup() {
  const world = World.generate({ seed: 1, content, layerSizeTiles: 64 });
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      world.setTile(0, x, y, 'ground', 'base:grass');
      world.setTile(0, x, y, 'floor', null);
      world.setTile(0, x, y, 'object', null);
    }
  }
  // By day: no monster comes on its own.
  const test = createTestContext({
    config,
    world,
    clock: new WorldClock(TIME.daytimeMs / 2),
    modules: [playersModule, inventoryModule, harvestModule, spawningModule, aiModule],
  });
  const { ctx } = test;
  const addPlayer = (x: number, y: number) =>
    ctx.entities.create('player', {
      position: { layer: LAYER.surface, x, y },
      player: { name: 'Ana', playerId: 1 },
      health: 20,
    });
  const addMonster = (x: number, y: number, creature = PROWLER.id) =>
    ctx.entities.create('monster', {
      position: { layer: LAYER.surface, x, y },
      health: content.creatures.require(creature).hp,
      monster: { creature },
    });
  const place = (tile: string, tiles: readonly (readonly [number, number])[]) => {
    for (const [x, y] of tiles) {
      world.setTile(0, x, y, 'object', tile);
    }
  };
  const wallHits: ServerEvents['tile.hit'][] = [];
  ctx.events.on('tile.hit', (event) => wallHits.push(event));
  return { ...test, addPlayer, addMonster, place, wallHits };
}

/** The tiles of the outline of a box, from (x0, y0) to (x1, y1) included. */
function outline(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const tiles: [number, number][] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x === x0 || x === x1 || y === y0 || y === y1) {
        tiles.push([x, y]);
      }
    }
  }
  return tiles;
}

describe('ai module', () => {
  it('notices a player within 10 tiles, goes around what blocks it and hits them', () => {
    const { ctx, tick, addPlayer, addMonster, place, wallHits } = setup();
    const player = addPlayer(55.5, 20.5);
    const monster = addMonster(47.5, 20.5);
    // Oaks cannot be broken through: around them.
    place(
      'base:oak_tree',
      [16, 17, 18, 19, 20, 21, 22, 23, 24].map((y) => [51, y] as const),
    );

    tick(10);
    expect(ctx.entities.get(monster, 'ai')).toMatchObject({ mode: 'chase', target: player });
    tick(200);

    expect(ctx.entities.get(player, 'health')).toBeLessThan(20);
    expect(wallHits).toEqual([]);
  });

  it('ignores a player out of sight, or in the safe zone', () => {
    const { ctx, tick, addPlayer, addMonster } = setup();
    addPlayer(55.5, 45.5);
    const far = addMonster(55.5, 32.5);
    // The safe zone is around tile 32: the player stands in it, the monster beside it.
    addPlayer(32.5, 32.5);
    const beside = addMonster(32.5, 39.5);

    tick(10);

    expect(ctx.entities.get(far, 'ai')?.mode).toBe('wander');
    expect(ctx.entities.get(beside, 'ai')?.mode).toBe('wander');
  });

  it('gives up when its target gets too far', () => {
    const { ctx, tick, addPlayer, addMonster } = setup();
    const player = addPlayer(55.5, 20.5);
    const monster = addMonster(50.5, 20.5);
    tick(10);
    expect(ctx.entities.get(monster, 'ai')?.mode).toBe('chase');

    ctx.entities.set(player, 'position', { layer: 0, x: 55.5, y: 60.5 });
    tick();

    expect(ctx.entities.get(monster, 'ai')?.mode).toBe('wander');
    expect(ctx.entities.get(monster, 'ai')?.target).toBeUndefined();
  });

  it('breaks through a wall or the door of a closed room to reach the player inside', () => {
    const { ctx, tick, addPlayer, addMonster, place, wallHits } = setup();
    place('base:wooden_wall', outline(53, 18, 57, 22));
    place('base:wooden_door', [[55, 22]]);
    const player = addPlayer(55.5, 20.5);
    const monster = addMonster(55.5, 27.5);

    tick(400);

    expect(wallHits.length).toBeGreaterThan(0);
    expect(wallHits.every((hit) => hit.by === monster && hit.amount === PROWLER.damage)).toBe(true);
    // One tile of the room, always the same (the door or a wall beside it), until it breaks.
    const [first] = wallHits;
    expect(outline(53, 18, 57, 22).some(([x, y]) => x === first?.x && y === first?.y)).toBe(true);
    expect(wallHits.every((hit) => hit.x === first?.x && hit.y === first?.y)).toBe(true);
    expect(ctx.world.getTile(0, first?.x ?? 0, first?.y ?? 0, 'object')).toBeUndefined();
    expect(ctx.entities.get(player, 'health')).toBeLessThan(20);
  });

  it('never hits a wall of an empty base, even right beside it', () => {
    const { tick, addPlayer, addMonster, place, wallHits } = setup();
    place('base:wooden_wall', outline(53, 18, 57, 22));
    place('base:wooden_door', [[55, 22]]);
    addPlayer(10.5, 50.5);
    addMonster(55.5, 23.5);
    addMonster(52.5, 20.5);

    tick(600);

    expect(wallHits).toEqual([]);
  });

  it('goes around a short wall rather than breaking it', () => {
    const { ctx, tick, addPlayer, addMonster, place, wallHits } = setup();
    place('base:wooden_wall', [
      [51, 19],
      [51, 20],
      [51, 21],
    ]);
    const player = addPlayer(55.5, 20.5);
    addMonster(47.5, 20.5);

    tick(200);

    expect(wallHits).toEqual([]);
    expect(ctx.entities.get(player, 'health')).toBeLessThan(20);
  });

  it('kills a player it keeps hitting, with the monster as the cause', () => {
    const { ctx, tick, addPlayer, addMonster } = setup();
    const died: ServerEvents['entity.died'][] = [];
    ctx.events.on('entity.died', (event) => died.push(event));
    const player = addPlayer(55.5, 20.5);
    ctx.entities.set(player, 'health', 2);
    const monster = addMonster(53.5, 20.5);

    tick(100);

    expect(ctx.entities.get(player, 'dead')).toBe('monster');
    expect(died).toEqual([
      expect.objectContaining({ entity: player, source: { cause: 'monster', by: monster } }),
    ]);
    expect(ctx.entities.get(monster, 'ai')?.mode).toBe('wander');
  });
});

describe('facingToward', () => {
  it('faces the main axis of the move, and keeps its facing when still', () => {
    expect(facingToward(2, 1, 'up')).toBe('right');
    expect(facingToward(-0.5, 3, 'up')).toBe('down');
    expect(facingToward(0, -1, 'left')).toBe('up');
    expect(facingToward(0, 0, 'left')).toBe('left');
  });
});
