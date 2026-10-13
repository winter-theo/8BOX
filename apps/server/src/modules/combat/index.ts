import {
  attackReady,
  chunkCoord,
  createMovementWorld,
  type Facing,
  heldWeapon,
  hitZone,
  inHitZone,
  knockback,
  LAYER,
  type LayerId,
  PLAYER,
  pushMover,
  pvpAllowed,
  type SafeZone,
  type ServerMessage,
} from '@8box/shared';
import { damage } from '../../core/damage';
import type { EntityId, Position } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';

/** A fight between two players: who hit first, and when either last hit the other. */
interface Fight {
  first: EntityId;
  lastTick: number;
}

/** Key of the fight between two entities, whatever the order. */
function fightKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** The safe zone around the spawn of the world. */
function safeZoneOf(ctx: ServerContext): SafeZone {
  const { spawn } = ctx.world;
  return {
    layer: LAYER.surface,
    x: spawn.x,
    y: spawn.y,
    radiusTiles: ctx.config.world.safeZoneRadiusTiles,
  };
}

/** Sends a message to the players who follow the chunk of `position`, except `except`. */
function sendNear(
  ctx: ServerContext,
  position: Position,
  message: ServerMessage,
  except?: EntityId,
): void {
  const ref = { layer: position.layer, cx: chunkCoord(position.x), cy: chunkCoord(position.y) };
  for (const session of ctx.net.allSessions()) {
    const entity = session.player?.entity;
    if (session.state === 'playing' && entity !== except && session.chunks?.has(ref)) {
      ctx.net.send(session, message);
    }
  }
}

/**
 * Combat, the Zelda way: "attack" (an action on oneself) hits in front of the player, with the weapon
 * in hand or bare-handed, never faster than the cooldown of the weapon. Every entity with health whose
 * box overlaps the hit zone takes the damage of the weapon (`damage`), is pushed back half a tile
 * toward the facing of the attacker (stopped by walls) and cannot be hurt for a moment; the weapon wears
 * once per hit that lands. Players do not hurt each other when either stands in the safe zone. The
 * players nearby are sent the swing (`swing`) and the damage (`damaged`, also for hunger). A player
 * killed by another one emits `player.killed`, with who hit first in their fight.
 */
export const combatModule: GameModule = {
  id: 'combat',
  dependsOn: ['players'],
  init(ctx) {
    const { combat } = ctx.config;
    /** Tick when each entity last started a hit. */
    const lastHit = new Map<EntityId, number>();
    const fights = new Map<string, Fight>();
    const fightTicks = ctx.scheduler.ticksFor(combat.fightMemoryMs);
    const invulnerabilityTicks = ctx.scheduler.ticksFor(combat.hitInvulnerabilityMs);

    /** Remembers that `attacker` hit `target`: a new fight when they had not fought lately. */
    const rememberFight = (attacker: EntityId, target: EntityId, tick: number) => {
      const key = fightKey(attacker, target);
      const fight = fights.get(key);
      if (!fight || tick - fight.lastTick > fightTicks) {
        fights.set(key, { first: attacker, lastTick: tick });
      } else {
        fight.lastTick = tick;
      }
    };

    /** Pushes a hit entity toward `facing`, stopped by the solid tiles. */
    const pushBack = (entity: EntityId, position: Position, facing: Facing) => {
      const layer = position.layer as LayerId;
      const world = createMovementWorld(
        (x, y, slot) => ctx.world.getTile(layer, x, y, slot),
        (x, y) => ctx.world.isInside(x, y),
        (x, y) => ctx.world.getMeta(layer, x, y),
      );
      const push = knockback(facing, combat);
      const moved = pushMover({ ...position, facing }, push.dx, push.dy, world);
      ctx.entities.set(entity, 'position', { layer: position.layer, x: moved.x, y: moved.y });
    };

    ctx.actions.register('attack', ({ entity }) => {
      const position = ctx.entities.get(entity, 'position');
      const inventory = ctx.entities.get(entity, 'inventory');
      const facing = ctx.entities.get(entity, 'facing') ?? 'down';
      const weapon = inventory && heldWeapon(inventory, ctx.content, combat);
      if (!position || !inventory || !weapon) {
        return 'unavailable';
      }
      const tick = ctx.scheduler.currentTick;
      if (!attackReady(lastHit.get(entity), tick, ctx.scheduler.ticksFor(weapon.cooldownMs))) {
        return 'tooSoon';
      }
      lastHit.set(entity, tick);
      sendNear(
        ctx,
        position,
        { t: 'swing', entity, facing, ...(weapon.item !== undefined && { item: weapon.item }) },
        entity,
      );
      const attackerIsPlayer = ctx.entities.typeOf(entity) === 'player';
      const zone = hitZone(position.x, position.y, facing, combat);
      const searchTiles = combat.hitRangeTiles + combat.hitWidthTiles + PLAYER.hitboxSizeTiles;
      let landed = false;
      for (const target of ctx.entities.near(position.layer, position.x, position.y, searchTiles)) {
        const at = ctx.entities.get(target, 'position');
        if (
          target === entity ||
          !at ||
          !ctx.entities.has(target, 'health') ||
          ctx.entities.has(target, 'dead') ||
          !inHitZone(zone, at.x, at.y)
        ) {
          continue;
        }
        const targetIsPlayer = ctx.entities.typeOf(target) === 'player';
        if (attackerIsPlayer && targetIsPlayer) {
          if (!pvpAllowed(safeZoneOf(ctx), position.layer, position, at)) {
            continue;
          }
          rememberFight(entity, target, tick);
        }
        if (damage(ctx, target, weapon.damage, { cause: 'hit', by: entity }) === 0) {
          continue;
        }
        landed = true;
        if (!ctx.entities.has(target, 'dead')) {
          ctx.entities.set(target, 'invulnerableUntilTick', tick + invulnerabilityTicks);
          pushBack(target, at, facing);
        }
      }
      if (landed && weapon.item !== undefined) {
        ctx.events.emit('tool.used', { entity, item: weapon.item, slot: inventory.selected });
      }
      return undefined;
    });

    ctx.events.on('entity.damaged', ({ entity, amount, position }) => {
      sendNear(ctx, position, { t: 'damaged', entity, amount });
    });

    ctx.events.on('entity.died', ({ entity, type, source }) => {
      const killer = source.by;
      if (type !== 'player' || killer === undefined || ctx.entities.typeOf(killer) !== 'player') {
        return;
      }
      const key = fightKey(killer, entity);
      const firstHit = fights.get(key)?.first ?? killer;
      fights.delete(key); // The fight is over: the next hit starts a new one.
      ctx.log.info({ killer, victim: entity, firstHit }, 'player killed');
      ctx.events.emit('player.killed', { killer, victim: entity, firstHit });
    });

    ctx.events.on('entity.removed', ({ entity }) => {
      lastHit.delete(entity);
      for (const key of fights.keys()) {
        const [a, b] = key.split(':').map(Number);
        if (a === entity || b === entity) {
          fights.delete(key);
        }
      }
    });
  },
};
