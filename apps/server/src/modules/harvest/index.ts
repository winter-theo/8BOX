import {
  CHUNK_AREA,
  CHUNK_SIZE,
  chunkCoord,
  createRng,
  harvestActionSchema,
  harvestDamage,
  heldStack,
  LAYER,
  type LayerId,
  rollLoot,
  type TileDef,
  type TileSlot,
  tileCode,
  tileTarget,
} from '@8box/shared';
import type { PerformAction } from '../../core/actions';
import type { EntityId } from '../../core/entities';
import type { GameModule, ServerContext } from '../../core/module';

/** A tile being broken: the HP it has left, until it is broken or gets them back. */
interface Damage {
  layer: LayerId;
  x: number;
  y: number;
  /** The tile id being broken (a new tile there starts undamaged). */
  tile: string;
  hp: number;
  maxHp: number;
  /** Tick of the last hit: 30 s later (`hpRecoveryDelayMs`), the tile gets all its HP back. */
  lastHitTick: number;
}

function keyOf(layer: number, x: number, y: number): string {
  return `${layer}:${x}:${y}`;
}

/** Sends the HP of a tile to the clients that follow its chunk. */
function sendDamage(ctx: ServerContext, damage: Damage): void {
  const { layer, x, y, hp, maxHp } = damage;
  const ref = { layer, cx: chunkCoord(x), cy: chunkCoord(y) };
  for (const session of ctx.net.allSessions()) {
    if (session.chunks?.has(ref)) {
      ctx.net.send(session, { t: 'tileDamage', layer, x, y, hp, maxHp });
    }
  }
}

/**
 * Grows back the tile of each tile slot that holds a growing tile (`regrow`), as if it had just been
 * picked: the time left before the server stopped is not saved.
 */
function regrowSavedTiles(
  ctx: ServerContext,
  schedule: (x: number, y: number, tile: TileDef) => void,
) {
  const growing = new Map<number, TileDef>();
  for (const tile of ctx.content.tiles.all) {
    if (tile.regrow) {
      growing.set(tileCode(ctx.content, tile.id), tile);
    }
  }
  if (growing.size === 0) {
    return;
  }
  const slots = new Set([...growing.values()].map((tile) => tile.slot));
  for (let cy = 0; cy < ctx.world.chunksPerSide; cy++) {
    for (let cx = 0; cx < ctx.world.chunksPerSide; cx++) {
      const chunk = ctx.world.getChunk(LAYER.surface, cx, cy);
      for (const slot of slots) {
        const codes = chunk?.slot(slot);
        for (let i = 0; codes && i < CHUNK_AREA; i++) {
          const tile = growing.get(codes[i] ?? 0);
          if (tile?.slot === slot) {
            schedule(
              cx * CHUNK_SIZE + (i % CHUNK_SIZE),
              cy * CHUNK_SIZE + Math.floor(i / CHUNK_SIZE),
              tile,
            );
          }
        }
      }
    }
  }
}

/**
 * Harvesting: "cut", "uproot" and "break" hit a tile (the one named by `harvest.action` of the tile).
 * Each hit takes HP depending on the item in hand (`harvestDamage`); clients that follow the chunk are
 * sent the HP left (`tileDamage`), and a tile left alone for `hpRecoveryDelayMs` gets them all back.
 * At 0 the tile goes away (`tile.broken`), and its loot goes to the player who broke it (`items.give`):
 * only that hit breaks it, so two players hitting the same tree get a single loot. "Pick" gives the
 * loot of a berry bush and turns it into a picked bush, which grows back (`regrow` of the tile). The
 * safe zone is checked by `canPerform` (interaction module). A monster that hits a wall or a door in
 * its way (`tile.hit`) takes its HP the same way, and breaks it without loot.
 */
export const harvestModule: GameModule = {
  id: 'harvest',
  dependsOn: ['players'],
  init(ctx) {
    const damaged = new Map<string, Damage>();
    const recoveryTicks = ctx.scheduler.ticksFor(ctx.config.harvest.hpRecoveryDelayMs);
    // Loot needs no replay: a new sequence every run.
    const rng = createRng((Date.now() ^ ctx.world.seed) >>> 0);

    /** Rolls a loot table for a player. */
    const giveLoot = (entity: EntityId, tableId: string | undefined) => {
      const table = tableId === undefined ? undefined : ctx.content.loot.get(tableId);
      const items = table ? rollLoot(table, rng) : [];
      if (items.length > 0) {
        ctx.events.emit('items.give', { entity, items });
      }
    };

    /** Turns a growing tile back into what it grows into, unless something else is there by then. */
    const scheduleRegrow = (layer: LayerId, x: number, y: number, tile: TileDef) => {
      const regrow = tile.regrow;
      if (!regrow) {
        return;
      }
      ctx.scheduler.after(
        regrow.afterMs,
        () => {
          if (ctx.world.getTile(layer, x, y, tile.slot)?.id === tile.id) {
            ctx.world.setTile(layer, x, y, tile.slot, regrow.into);
          }
        },
        'regrow a tile',
      );
    };

    /**
     * Takes `amount` HP from tile `tile` in slot `slot` of (x, y): the clients are sent the HP left, and
     * at 0 the tile is broken (`tile.broken`, by `by`). Returns whether it broke.
     */
    const wear = (
      layer: LayerId,
      x: number,
      y: number,
      slot: TileSlot,
      tile: TileDef,
      amount: number,
      by: EntityId,
    ): boolean => {
      const key = keyOf(layer, x, y);
      const previous = damaged.get(key);
      const hp = (previous?.tile === tile.id ? previous.hp : tile.hp) - amount;
      if (hp > 0) {
        const damage: Damage = {
          layer,
          x,
          y,
          tile: tile.id,
          hp,
          maxHp: tile.hp,
          lastHitTick: ctx.scheduler.currentTick,
        };
        damaged.set(key, damage);
        sendDamage(ctx, damage);
        return false;
      }
      damaged.delete(key);
      ctx.world.setTile(layer, x, y, slot, null);
      ctx.events.emit('tile.broken', { layer, x, y, slot, tile: tile.id, by });
      return true;
    };

    const hit: PerformAction = ({ entity, subject }) => {
      const position = ctx.entities.get(entity, 'position');
      const inventory = ctx.entities.get(entity, 'inventory');
      const target = tileTarget(subject, ctx.content);
      if (!position || !inventory || subject.kind !== 'tile' || !target) {
        return 'unavailable';
      }
      const layer = position.layer as LayerId;
      const { x, y } = subject;
      const { slot, tile } = target;
      const held = heldStack(inventory);
      const heldDef = held ? ctx.content.items.get(held.item) : undefined;
      if (held && heldDef?.tool) {
        ctx.events.emit('tool.used', { entity, item: held.item, slot: inventory.selected });
      }
      if (wear(layer, x, y, slot, tile, harvestDamage(tile, heldDef), entity)) {
        giveLoot(entity, tile.loot);
      }
      return undefined;
    };
    for (const id of harvestActionSchema.options) {
      ctx.actions.register(id, hit);
    }

    ctx.actions.register('pick', ({ entity, subject }) => {
      const position = ctx.entities.get(entity, 'position');
      const target = tileTarget(subject, ctx.content);
      const pick = target?.tile.pick;
      if (!position || subject.kind !== 'tile' || !target || !pick) {
        return 'unavailable';
      }
      ctx.world.setTile(position.layer as LayerId, subject.x, subject.y, target.slot, pick.becomes);
      giveLoot(entity, pick.loot);
      return undefined;
    });

    // A monster hits a wall or a door in its way: no loot when it breaks.
    ctx.events.on('tile.hit', ({ layer, x, y, slot, amount, by }) => {
      const tile = ctx.world.getTile(layer, x, y, slot);
      if (tile && tile.hp > 0 && amount > 0) {
        wear(layer, x, y, slot, tile, amount, by);
      }
    });

    // A tile that changes is no longer the one being broken; a growing tile starts growing.
    ctx.events.on('tile.changed', ({ layer, x, y, tile }) => {
      damaged.delete(keyOf(layer, x, y));
      const def = tile === null ? undefined : ctx.content.tiles.get(tile);
      if (def?.regrow) {
        scheduleRegrow(layer, x, y, def);
      }
    });
    regrowSavedTiles(ctx, (x, y, tile) => scheduleRegrow(LAYER.surface, x, y, tile));

    ctx.systems.add({
      name: 'harvest: hp recovery',
      phase: 'simulate',
      run: () => {
        const tick = ctx.scheduler.currentTick;
        for (const [key, damage] of damaged) {
          if (tick - damage.lastHitTick >= recoveryTicks) {
            damaged.delete(key);
            sendDamage(ctx, { ...damage, hp: damage.maxHp });
          }
        }
      },
    });
  },
};
