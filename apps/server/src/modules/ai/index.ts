import {
  type CreatureDef,
  createMovementWorld,
  createPathGrid,
  createRng,
  DIRECTIONS,
  type Facing,
  findPath,
  inSafeZone,
  type LayerId,
  MAX_DIRECTION,
  type MovementWorld,
  type PathGrid,
  PLAYER,
  pushMover,
  wallAhead,
} from '@8box/shared';
import { hitEntity } from '../../core/damage';
import type { AiState, EntityId, Position } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';
import { safeZoneOf } from '../../core/safeZone';

/** A monster is on the tile it walks to when this close to its centre, in tiles. */
const ARRIVED_TILES = 0.15;

/** How a monster sees a layer: the safe zone blocks it, walls and doors can be broken through. */
interface MonsterWorld {
  movement: MovementWorld;
  grid: PathGrid;
}

/** The facing of a move or of a look toward (dx, dy). */
export function facingToward(dx: number, dy: number, previous: Facing): Facing {
  if (dx === 0 && dy === 0) {
    return previous;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

function newAi(tick: number): AiState {
  return {
    mode: 'wander',
    wanderDx: 0,
    wanderDy: 0,
    wanderUntilTick: tick,
    lookTick: tick,
    path: [],
    pathTick: 0,
  };
}

/**
 * Behaviour of the monsters, every tick. A monster wanders: it walks a while in a random direction,
 * then rests. Hostile, it looks around for the nearest living player within 10 tiles (out of the safe
 * zone) and chases them: along a path found with A* (in a square of 16 tiles around it, searched again
 * at most twice per second), or straight at them when close or when there is no path. In reach, it
 * hits them (`hitEntity`) as often as its creature allows. When its path goes through a wall or a closed
 * door (no other way, or a much longer one), it hits that tile (`tile.hit`) until it breaks: only while
 * it chases someone, so an empty base risks nothing. It gives up when its target dies, goes into the
 * safe zone (where monsters never go) or gets 16 tiles away. A slime moves by hops.
 */
export const aiModule: GameModule = {
  id: 'ai',
  dependsOn: ['players', 'spawning'],
  init(ctx) {
    const { monsters } = ctx.config;
    const zone = safeZoneOf(ctx);
    const tickMs = 1000 / ctx.config.net.tickRateHz;
    const lookTicks = ctx.scheduler.ticksFor(monsters.lookIntervalMs);
    const repathTicks = ctx.scheduler.ticksFor(monsters.repathIntervalMs);
    const wanderTicks = ctx.scheduler.ticksFor(monsters.wanderMoveMs);
    // Wandering needs no replay: a new sequence every run.
    const rng = createRng((Date.now() ^ ctx.world.seed ^ 0x5eed) >>> 0);
    const worlds = new Map<LayerId, MonsterWorld>();
    const worldOf = (layer: LayerId): MonsterWorld => {
      let world = worlds.get(layer);
      if (!world) {
        const tiles = createMovementWorld(
          (x, y, slot) => ctx.world.getTile(layer, x, y, slot),
          (x, y) => ctx.world.isInside(x, y),
          (x, y) => ctx.world.getMeta(layer, x, y),
        );
        const safe = (x: number, y: number) => inSafeZone(zone, layer, x, y);
        const movement: MovementWorld = {
          isSolid: (x, y) => tiles.isSolid(x, y) || safe(x, y),
          speedFactor: tiles.speedFactor,
        };
        const breakable = (x: number, y: number) => {
          const object = ctx.world.getTile(layer, x, y, 'object');
          return (
            !safe(x, y) && object !== undefined && object.hp > 0 && !!(object.wall || object.door)
          );
        };
        world = { movement, grid: createPathGrid(movement, breakable) };
        worlds.set(layer, world);
      }
      return world;
    };
    // Tiles change all the time: the views read the world, they never copy it.

    /** Whether a player can be chased: alive, on the layer of the monster, out of the safe zone. */
    const chaseable = (player: EntityId, layer: number): Position | undefined => {
      const at = ctx.entities.get(player, 'position');
      if (
        !at ||
        at.layer !== layer ||
        ctx.entities.typeOf(player) !== 'player' ||
        ctx.entities.has(player, 'dead') ||
        inSafeZone(zone, at.layer, Math.floor(at.x), Math.floor(at.y))
      ) {
        return undefined;
      }
      return at;
    };

    /** The nearest player a monster at `position` notices, if any. */
    const lookAround = (position: Position): EntityId | undefined => {
      let nearest: EntityId | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;
      const range = monsters.detectionRangeTiles;
      for (const entity of ctx.entities.near(position.layer, position.x, position.y, range)) {
        const at = chaseable(entity, position.layer);
        const distance = at && Math.hypot(at.x - position.x, at.y - position.y);
        if (distance !== undefined && distance < nearestDistance) {
          nearest = entity;
          nearestDistance = distance;
        }
      }
      return nearest;
    };

    /** Whether a monster may hit again (a character or a wall). */
    const hitReady = (ai: AiState, creature: CreatureDef, tick: number) =>
      ai.lastHitTick === undefined ||
      tick - ai.lastHitTick >= ctx.scheduler.ticksFor(creature.attackCooldownMs);

    /**
     * Moves a monster toward (dx, dy), at most `maxTiles`, at its speed (by hops for a slime), stopped
     * by what blocks it. Sets its facing and its walking.
     */
    const walk = (
      monster: EntityId,
      creature: CreatureDef,
      position: Position,
      dx: number,
      dy: number,
      maxTiles: number,
      dt: number,
      tick: number,
    ) => {
      const length = Math.hypot(dx, dy);
      const facing = ctx.entities.get(monster, 'facing') ?? 'down';
      const hop = creature.hop;
      const resting =
        hop !== undefined &&
        (tick * tickMs + monster * 137) % (hop.moveMs + hop.restMs) >= hop.moveMs;
      if (length === 0 || maxTiles <= 0 || resting) {
        setLook(monster, facingToward(dx, dy, facing), 'idle');
        return;
      }
      const { movement } = worldOf(position.layer as LayerId);
      const speed =
        creature.speedTilesPerSecond *
        movement.speedFactor(Math.floor(position.x), Math.floor(position.y));
      const distance = Math.min(speed * dt, maxTiles);
      const moved = pushMover(
        { x: position.x, y: position.y, facing },
        (dx / length) * distance,
        (dy / length) * distance,
        movement,
        PLAYER.hitboxSizeTiles,
      );
      const changed = moved.x !== position.x || moved.y !== position.y;
      if (changed) {
        ctx.entities.set(monster, 'position', { layer: position.layer, x: moved.x, y: moved.y });
      }
      setLook(monster, facingToward(dx, dy, facing), changed ? 'walk' : 'idle');
    };

    const setLook = (monster: EntityId, facing: Facing, anim: 'idle' | 'walk') => {
      if (ctx.entities.get(monster, 'facing') !== facing) {
        ctx.entities.set(monster, 'facing', facing);
      }
      if (ctx.entities.get(monster, 'anim') !== anim) {
        ctx.entities.set(monster, 'anim', anim);
      }
    };

    /** A hit of a monster, shown to the players nearby as a swing. */
    const swing = (
      monster: EntityId,
      position: Position,
      facing: Facing,
      ai: AiState,
      tick: number,
    ) => {
      ai.lastHitTick = tick;
      ctx.net.sendNear(position, { t: 'swing', entity: monster, facing });
    };

    const wander = (
      monster: EntityId,
      creature: CreatureDef,
      position: Position,
      ai: AiState,
      dt: number,
      tick: number,
    ) => {
      if (tick >= ai.wanderUntilTick) {
        const walking = ai.wanderDx !== 0 || ai.wanderDy !== 0;
        if (walking) {
          ai.wanderDx = 0;
          ai.wanderDy = 0;
          ai.wanderUntilTick = tick + ctx.scheduler.ticksFor(rng.float(0, monsters.wanderRestMs));
        } else {
          const [dx, dy] = DIRECTIONS[rng.int(1, MAX_DIRECTION)] ?? [0, 0];
          ai.wanderDx = dx;
          ai.wanderDy = dy;
          ai.wanderUntilTick = tick + wanderTicks;
        }
      }
      walk(
        monster,
        creature,
        position,
        ai.wanderDx,
        ai.wanderDy,
        Number.POSITIVE_INFINITY,
        dt,
        tick,
      );
    };

    const chase = (
      monster: EntityId,
      creature: CreatureDef,
      position: Position,
      target: Position,
      ai: AiState,
      dt: number,
      tick: number,
    ) => {
      const dx = target.x - position.x;
      const dy = target.y - position.y;
      const distance = Math.hypot(dx, dy);
      const facing = facingToward(dx, dy, ctx.entities.get(monster, 'facing') ?? 'down');
      if (distance <= monsters.attackRangeTiles) {
        setLook(monster, facing, 'idle');
        if (ai.target !== undefined && hitReady(ai, creature, tick)) {
          swing(monster, position, facing, ai, tick);
          hitEntity(ctx, ai.target, creature.damage, { cause: 'monster', by: monster }, facing);
        }
        return;
      }
      if (distance <= monsters.closeChaseTiles) {
        walk(
          monster,
          creature,
          position,
          dx,
          dy,
          distance - monsters.attackRangeTiles / 2,
          dt,
          tick,
        );
        return;
      }
      const layer = position.layer as LayerId;
      const { grid } = worldOf(layer);
      if (tick - ai.pathTick >= repathTicks) {
        ai.pathTick = tick;
        ai.path =
          findPath(
            grid,
            { x: Math.floor(position.x), y: Math.floor(position.y) },
            { x: Math.floor(target.x), y: Math.floor(target.y) },
            { radiusTiles: monsters.pathRadiusTiles, wallCost: monsters.wallPathCost },
          ) ?? [];
      }
      // Tiles reached are behind it.
      let next = ai.path[0];
      while (
        next &&
        Math.hypot(next.x + 0.5 - position.x, next.y + 0.5 - position.y) < ARRIVED_TILES
      ) {
        ai.path.shift();
        next = ai.path[0];
      }
      if (!next) {
        walk(monster, creature, position, dx, dy, distance, dt, tick);
        return;
      }
      const wall = wallAhead(ai.path, grid);
      if (wall) {
        const toWall = facingToward(wall.x + 0.5 - position.x, wall.y + 0.5 - position.y, facing);
        setLook(monster, toWall, 'idle');
        if (hitReady(ai, creature, tick)) {
          swing(monster, position, toWall, ai, tick);
          ctx.events.emit('tile.hit', {
            layer,
            x: wall.x,
            y: wall.y,
            slot: 'object',
            amount: creature.damage,
            by: monster,
          });
        }
        return;
      }
      const toNextX = next.x + 0.5 - position.x;
      const toNextY = next.y + 0.5 - position.y;
      walk(monster, creature, position, toNextX, toNextY, Math.hypot(toNextX, toNextY), dt, tick);
    };

    ctx.systems.add({
      name: 'ai: monsters',
      phase: 'simulate',
      run: (_ctx, dt) => {
        const tick = ctx.scheduler.currentTick;
        for (const monster of ctx.entities.query('monster')) {
          const position = ctx.entities.get(monster, 'position');
          const creatureId = ctx.entities.get(monster, 'monster')?.creature;
          const creature =
            creatureId === undefined ? undefined : ctx.content.creatures.get(creatureId);
          if (!position || !creature || ctx.entities.has(monster, 'dead')) {
            continue;
          }
          let ai = ctx.entities.get(monster, 'ai');
          if (!ai) {
            ai = newAi(tick);
            ctx.entities.set(monster, 'ai', ai);
          }
          let target = ai.target === undefined ? undefined : chaseable(ai.target, position.layer);
          if (
            ai.mode === 'chase' &&
            (!target ||
              Math.hypot(target.x - position.x, target.y - position.y) >
                monsters.giveUpDistanceTiles)
          ) {
            Object.assign(ai, newAi(tick));
            delete ai.target;
            target = undefined;
          }
          if (ai.mode === 'wander' && creature.hostile && tick - ai.lookTick >= lookTicks) {
            ai.lookTick = tick;
            const seen = lookAround(position);
            if (seen !== undefined) {
              ai.mode = 'chase';
              ai.target = seen;
              ai.path = [];
              ai.pathTick = tick - repathTicks;
              target = chaseable(seen, position.layer);
            }
          }
          if (ai.mode === 'chase' && target) {
            chase(monster, creature, position, target, ai, dt, tick);
          } else {
            wander(monster, creature, position, ai, dt, tick);
          }
        }
      },
    });
  },
};
