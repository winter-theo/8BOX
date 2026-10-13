import {
  addFatigue,
  createMovementWorld,
  eatFood,
  heldFood,
  LAYER,
  type LayerId,
  SECOND_MS,
  stepVitals,
  takeItems,
  type Vitals,
} from '@8box/shared';
import { damage } from '../../core/damage';
import type { EntityId, Position } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';
import { type RespawnWorld, respawnPoint } from './respawn';

/** Time gathered toward the next changes of a player's vitals. */
type Timers = Omit<Vitals, 'health' | 'hunger'>;

const NO_TIME: Timers = { hungerMs: 0, starvationMs: 0, regenMs: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Beds and free tiles of the server world (a closed door, an object or deep water is not free). */
function respawnWorld(ctx: ServerContext): RespawnWorld {
  const movement = (layer: number) =>
    createMovementWorld(
      (x, y, slot) => ctx.world.getTile(layer as LayerId, x, y, slot),
      (x, y) => ctx.world.isInside(x, y),
      (x, y) => ctx.world.getMeta(layer as LayerId, x, y),
    );
  return {
    isBed: (layer, x, y) =>
      ctx.world.isInside(x, y) && ctx.world.getTile(layer as LayerId, x, y, 'object')?.bed === true,
    isFree: (layer, x, y) => !movement(layer).isSolid(x, y),
  };
}

/** The spawn of the world, where new players appear. */
function worldSpawn(ctx: ServerContext): Position {
  return { layer: LAYER.surface, x: ctx.world.spawn.x, y: ctx.world.spawn.y };
}

/**
 * Health and hunger of the players (`health` and `hunger` components, loaded and saved with the
 * character). Hunger drops over time, sooner with actions that take effort (`action.performed`); at 0
 * the player starves (`damage`), at 16 or more they heal. "Eat" (food in hand) restores hunger. At 0 HP
 * a player is `dead` where they stand (the inventory module drops a share of their gold there) until
 * they ask to respawn (`respawn`): next to their bed if it still exists, otherwise at the spawn, with
 * full health and hunger and a few seconds of invulnerability. A player who left while dead respawns
 * when they come back. Each player is sent their vitals (`vitals`) when they change.
 */
export const survivalModule: GameModule = {
  id: 'survival',
  dependsOn: ['players'],
  init(ctx) {
    const { survival } = ctx.config;
    const timers = new Map<EntityId, Timers>();
    /** What each player was last sent, as `health:hunger:dead`. */
    const sent = new Map<EntityId, string>();

    const respawn = (entity: EntityId) => {
      const bed = ctx.entities.get(entity, 'spawnPoint');
      const point = respawnPoint(bed, respawnWorld(ctx), worldSpawn(ctx));
      if (!point.bedExists) {
        ctx.entities.delete(entity, 'spawnPoint');
      }
      ctx.entities.set(entity, 'position', point.position);
      ctx.entities.set(entity, 'health', survival.respawnHealth);
      ctx.entities.set(entity, 'hunger', survival.respawnHunger);
      ctx.entities.delete(entity, 'dead');
      ctx.entities.set(
        entity,
        'invulnerableUntilTick',
        ctx.scheduler.currentTick + ctx.scheduler.ticksFor(survival.respawnInvulnerabilityMs),
      );
      timers.set(entity, { ...NO_TIME });
      ctx.log.info({ entity, position: point.position }, 'player respawned');
      ctx.events.emit('player.respawned', { entity, position: point.position });
    };

    ctx.events.on('player.joined', ({ entity }) => {
      const playerId = ctx.entities.get(entity, 'player')?.playerId;
      const saved = playerId === undefined ? undefined : ctx.persistence.character(playerId);
      timers.set(entity, { ...NO_TIME });
      if (saved?.health === 0) {
        respawn(entity);
        return;
      }
      const health = saved?.health ?? survival.maxHealth;
      const hunger = saved?.hunger ?? survival.maxHunger;
      ctx.entities.set(entity, 'health', clamp(health, 1, survival.maxHealth));
      ctx.entities.set(entity, 'hunger', clamp(hunger, 0, survival.maxHunger));
    });

    ctx.events.on('entity.removed', ({ entity }) => {
      timers.delete(entity);
      sent.delete(entity);
    });

    ctx.events.on('action.performed', ({ entity, action }) => {
      const current = timers.get(entity);
      if (current && ctx.actions.registry.get(action)?.effort) {
        timers.set(entity, addFatigue(current, survival.actionFatigueMs));
      }
    });

    ctx.actions.register('eat', ({ entity }) => {
      const inventory = ctx.entities.get(entity, 'inventory');
      const hunger = ctx.entities.get(entity, 'hunger');
      const food = inventory && heldFood(inventory, ctx.content);
      if (!inventory || !food || hunger === undefined) {
        return 'unavailable';
      }
      if (hunger >= survival.maxHunger) {
        return 'full';
      }
      const taken = takeItems(inventory, ctx.content.items, inventory.selected, 1);
      if (!taken) {
        return 'unavailable';
      }
      ctx.events.emit('inventory.set', { entity, inventory: taken.inventory });
      ctx.entities.set(entity, 'hunger', eatFood(hunger, food.hunger, survival));
      return undefined;
    });

    ctx.net.onMessage('respawn', (session) => {
      const entity = session.player?.entity;
      if (entity !== undefined && ctx.entities.has(entity, 'dead')) {
        respawn(entity);
      }
    });

    ctx.systems.add({
      name: 'survival: hunger and health',
      phase: 'simulate',
      run: (_ctx, dt) => {
        for (const entity of ctx.entities.query('player', 'health', 'hunger')) {
          const health = ctx.entities.get(entity, 'health');
          const hunger = ctx.entities.get(entity, 'hunger');
          if (health === undefined || hunger === undefined || ctx.entities.has(entity, 'dead')) {
            continue;
          }
          const step = stepVitals(
            { health, hunger, ...(timers.get(entity) ?? NO_TIME) },
            dt * SECOND_MS,
            survival,
          );
          const { health: nextHealth, hunger: nextHunger, ...nextTimers } = step.vitals;
          timers.set(entity, nextTimers);
          if (nextHunger !== hunger) {
            ctx.entities.set(entity, 'hunger', nextHunger);
          }
          if (nextHealth !== health) {
            ctx.entities.set(entity, 'health', nextHealth);
          }
          if (step.starvation > 0) {
            damage(ctx, entity, step.starvation, { cause: 'starvation' });
          }
        }
      },
    });

    ctx.systems.add({
      name: 'survival: send vitals',
      phase: 'net',
      run: () => {
        for (const session of ctx.net.allSessions()) {
          const entity = session.player?.entity;
          if (session.state !== 'playing' || entity === undefined) {
            continue;
          }
          const health = ctx.entities.get(entity, 'health');
          const hunger = ctx.entities.get(entity, 'hunger');
          const dead = ctx.entities.get(entity, 'dead');
          const state = `${health}:${hunger}:${dead ?? ''}`;
          if (health === undefined || hunger === undefined || sent.get(entity) === state) {
            continue;
          }
          sent.set(entity, state);
          ctx.net.send(session, { t: 'vitals', health, hunger, ...(dead && { dead }) });
        }
      },
    });
  },
};
