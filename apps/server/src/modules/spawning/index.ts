import {
  ambientLight,
  createMovementWorld,
  createRng,
  inSafeZone,
  isDaytime,
  isLit,
  LAYER,
  rollLoot,
} from '@8box/shared';
import type { EntityId } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';
import { safeZoneOf } from '../../core/safeZone';
import {
  canSpawnAt,
  farFromAll,
  nightCreatures,
  pickCreature,
  ringTile,
  type SpawnWorld,
  underCaps,
} from './rules';

/** What the spawning module remembers of a monster. */
interface Life {
  /** The player it appeared for: it counts in their cap while they are here. */
  owner?: EntityId;
  /** Tick since when it has been far from every player. */
  farSinceTick?: number;
  /** World time when it vanishes (dawn), in ms. */
  vanishAtMs?: number;
}

/** The surface as the spawning rules see it, at the current world time. */
function surfaceSpawnWorld(ctx: ServerContext): SpawnWorld {
  const layer = LAYER.surface;
  const tileAt: SpawnWorld['tileAt'] = (x, y, slot) => ctx.world.getTile(layer, x, y, slot);
  const metaAt = (x: number, y: number) => ctx.world.getMeta(layer, x, y);
  const zone = safeZoneOf(ctx);
  const lightWorld = { objectAt: (x: number, y: number) => tileAt(x, y, 'object') };
  return {
    movement: createMovementWorld(tileAt, (x, y) => ctx.world.isInside(x, y), metaAt),
    tileAt,
    metaAt,
    inSafeZone: (x, y) => inSafeZone(zone, layer, x, y),
    isLit: (x, y) => isLit(lightWorld, x, y, ctx.clock.timeMs, ctx.config.time, ctx.config.light),
  };
}

/**
 * Night monsters: their life, not their behaviour (ai module). Every `spawnIntervalMs`, at night once
 * it is dark, each connected player on the surface may get one more monster in the ring of 18 to 32 tiles
 * around them, on a tile where `canSpawnAt` allows it and far enough from every player (at most 6 per
 * player, 150 in all). At dawn, 80 % of the monsters are given a moment of its first 3 minutes to
 * vanish; a monster farther than 64 tiles from every player for 60 s vanishes. A dead monster drops
 * its loot where it died (`items.drop`) and is removed. Monsters are never saved.
 */
export const spawningModule: GameModule = {
  id: 'spawning',
  dependsOn: ['players'],
  init(ctx) {
    const { monsters, time } = ctx.config;
    const lives = new Map<EntityId, Life>();
    const creatures = nightCreatures(ctx.content.creatures.all);
    const farTicks = ctx.scheduler.ticksFor(monsters.farDespawnDelayMs);
    const minDistance = monsters.spawnMinDistanceTiles;
    // Spawns need no replay: a new sequence every run.
    const rng = createRng((Date.now() ^ ctx.world.seed) >>> 0);
    /** The day whose dawn was handled last. */
    let dawnDay = Math.floor(ctx.clock.timeMs / time.dayLengthMs);

    ctx.events.on('entity.created', ({ entity, type }) => {
      if (type === 'monster') {
        lives.set(entity, {});
      }
    });
    ctx.events.on('entity.removed', ({ entity, type }) => {
      lives.delete(entity);
      if (type === 'player') {
        for (const life of lives.values()) {
          if (life.owner === entity) {
            delete life.owner;
          }
        }
      }
    });

    ctx.events.on('entity.died', ({ entity, type, position }) => {
      const tableId =
        type === 'monster' ? ctx.entities.get(entity, 'monster')?.creature : undefined;
      const lootId = tableId === undefined ? undefined : ctx.content.creatures.get(tableId)?.loot;
      const table = lootId === undefined ? undefined : ctx.content.loot.get(lootId);
      const items = table ? rollLoot(table, rng) : [];
      if (items.length > 0) {
        ctx.events.emit('items.drop', { position, items });
      }
    });

    /** At dawn, picks the monsters that vanish, each at a moment of the dawn. */
    const handleDawn = (now: number) => {
      const day = Math.floor(now / time.dayLengthMs);
      if (day === dawnDay || !isDaytime(now, time)) {
        return;
      }
      dawnDay = day;
      const dawnStart = day * time.dayLengthMs;
      for (const life of lives.values()) {
        if (rng.next() < monsters.dawnDespawnFraction) {
          life.vanishAtMs = dawnStart + rng.float(0, time.twilightMs);
        }
      }
    };

    /** Removes the monsters whose time came, and those left far from every player for too long. */
    const despawn = (players: readonly { layer: number; x: number; y: number }[]) => {
      const now = ctx.clock.timeMs;
      const tick = ctx.scheduler.currentTick;
      for (const [entity, life] of lives) {
        const position = ctx.entities.get(entity, 'position');
        if (!position || (life.vanishAtMs !== undefined && life.vanishAtMs <= now)) {
          ctx.entities.remove(entity);
          continue;
        }
        const near = players.some(
          (p) =>
            p.layer === position.layer &&
            Math.hypot(p.x - position.x, p.y - position.y) <= monsters.farDespawnDistanceTiles,
        );
        if (near) {
          delete life.farSinceTick;
        } else if (life.farSinceTick === undefined) {
          life.farSinceTick = tick;
        } else if (tick - life.farSinceTick >= farTicks) {
          ctx.entities.remove(entity);
        }
      }
    };

    /** Gives one more monster to each player who may have one, at night once it is dark. */
    const spawn = (
      players: readonly { entity: EntityId; layer: number; x: number; y: number }[],
    ) => {
      const now = ctx.clock.timeMs;
      if (
        creatures.length === 0 ||
        isDaytime(now, time) ||
        ambientLight(now, time, ctx.config.light) >= ctx.config.light.litThreshold
      ) {
        return;
      }
      const world = surfaceSpawnWorld(ctx);
      const surface = players.filter((p) => p.layer === LAYER.surface);
      for (const player of surface) {
        if (ctx.entities.has(player.entity, 'dead')) {
          continue;
        }
        const own = [...lives.values()].filter((life) => life.owner === player.entity).length;
        if (!underCaps(own, lives.size, monsters)) {
          continue;
        }
        for (let i = 0; i < monsters.spawnTriesPerPlayer; i++) {
          const tile = ringTile(
            rng,
            player.x,
            player.y,
            minDistance,
            monsters.spawnMaxDistanceTiles,
          );
          if (
            !farFromAll(tile.x, tile.y, surface, minDistance) ||
            !canSpawnAt(world, tile.x, tile.y)
          ) {
            continue;
          }
          const creature = pickCreature(creatures, rng);
          if (!creature) {
            break;
          }
          const entity = ctx.entities.create('monster', {
            position: { layer: LAYER.surface, x: tile.x + 0.5, y: tile.y + 0.5 },
            facing: 'down',
            anim: 'idle',
            health: creature.hp,
            monster: { creature: creature.id },
          });
          const life = lives.get(entity);
          if (life) {
            life.owner = player.entity;
          }
          break;
        }
      }
    };

    ctx.scheduler.every(
      monsters.spawnIntervalMs,
      () => {
        const players = ctx.entities.query('player').flatMap((entity) => {
          const position = ctx.entities.get(entity, 'position');
          return position ? [{ entity, ...position }] : [];
        });
        handleDawn(ctx.clock.timeMs);
        despawn(players);
        spawn(players);
      },
      'spawning: round',
    );

    // A dead monster has dropped its loot: it goes before the clients are sent the next snapshot.
    ctx.systems.add({
      name: 'spawning: remove dead monsters',
      phase: 'post',
      run: () => {
        for (const entity of ctx.entities.query('monster', 'dead')) {
          ctx.entities.remove(entity);
        }
      },
    });
  },
};
