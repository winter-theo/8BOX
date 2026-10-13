import {
  addItems,
  cleanInventory,
  deathGoldLoss,
  emptyInventory,
  type Inventory,
  type ItemStack,
  moveItems,
  selectSlot,
  takeGold,
  takeItems,
  wearItem,
} from '@8box/shared';
import type { EntityId } from '../../core/entities';
import type { GameModule } from '../../core/module';
import type { Session } from '../../net/session';
import {
  dropPosition,
  expireGroundItems,
  pickUpGroundItems,
  spawnGroundItem,
  takePile,
} from './groundItems';

/**
 * What players carry: 10 slots (the hotbar, plus those of a worn bag), a purse for gold and equipment.
 * Clients ask for operations (`invSelect`, `invMove`, `invDrop`); the server checks them with the
 * shared rules, so that no item is ever created or lost, and sends the whole inventory back after each
 * change. Dropped items become `groundItem` entities: anyone walking on them picks them up (the player
 * who dropped them after 2 s), or takes them with the "pick up" action, piles of the same item merge,
 * and they disappear after 10 minutes. Tools wear with each hit (`tool.used`) and break at 0. Other
 * modules hand over the inventories they compute (`inventory.set`). The inventory is loaded with the
 * character and saved with it (see `characterToSave`).
 */
export const inventoryModule: GameModule = {
  id: 'inventory',
  dependsOn: ['players'],
  init(ctx) {
    const items = ctx.content.items;
    /** Players whose client has not been sent their inventory as it is now. */
    const changed = new Set<EntityId>();
    const update = (entity: EntityId, inventory: Inventory) => {
      ctx.entities.set(entity, 'inventory', inventory);
      changed.add(entity);
    };

    ctx.events.on('player.joined', ({ entity, name }) => {
      const playerId = ctx.entities.get(entity, 'player')?.playerId;
      const saved = playerId === undefined ? undefined : ctx.persistence.character(playerId);
      if (!saved) {
        update(entity, emptyInventory());
        return;
      }
      const { inventory, lost } = cleanInventory(saved.inventory, items);
      if (lost.length > 0) {
        ctx.log.warn({ name, lost }, 'saved items that no longer fit the content were removed');
      }
      update(entity, inventory);
    });
    ctx.events.on('entity.removed', ({ entity }) => changed.delete(entity));

    /** The player of a session and its inventory, while it is in the world. */
    const playerOf = (session: Session) => {
      const entity = session.player?.entity;
      const inventory = entity === undefined ? undefined : ctx.entities.get(entity, 'inventory');
      return entity === undefined || !inventory ? undefined : { entity, inventory };
    };

    /** A refused operation: the client gets its inventory again, to undo what it showed. */
    const refuse = (session: Session, entity: EntityId, operation: string) => {
      ctx.log.debug({ session: session.id, operation }, 'inventory operation refused');
      changed.add(entity);
    };

    const apply = (
      session: Session,
      operation: string,
      run: (inventory: Inventory) => Inventory | undefined,
    ) => {
      const player = playerOf(session);
      if (!player) {
        return;
      }
      const next = run(player.inventory);
      if (next) {
        update(player.entity, next);
      } else {
        refuse(session, player.entity, operation);
      }
    };

    ctx.net.onMessage('invSelect', (session, { slot }) =>
      apply(session, 'select', (inventory) => selectSlot(inventory, slot)),
    );

    ctx.net.onMessage('invMove', (session, { from, to, count }) =>
      apply(session, 'move', (inventory) => moveItems(inventory, items, from, to, count)),
    );

    ctx.net.onMessage('invDrop', (session, { from, count }) => {
      const player = playerOf(session);
      const position = player && ctx.entities.get(player.entity, 'position');
      if (!player || !position) {
        return;
      }
      let dropped: { inventory: Inventory; taken: ItemStack } | undefined;
      if (from === 'purse') {
        const gold = count ?? player.inventory.purse;
        const inventory = takeGold(player.inventory, gold);
        dropped = inventory && {
          inventory,
          taken: { item: ctx.config.inventory.currencyItem, count: gold },
        };
      } else {
        dropped = takeItems(player.inventory, items, from, count);
      }
      if (!dropped) {
        refuse(session, player.entity, 'drop');
        return;
      }
      update(player.entity, dropped.inventory);
      const facing = ctx.entities.get(player.entity, 'facing') ?? 'down';
      const droppedBy = ctx.entities.get(player.entity, 'player')?.playerId;
      spawnGroundItem(ctx, dropPosition(ctx, position, facing), dropped.taken, droppedBy);
    });

    // Dev mode only, until the `/give` command (step 24): what does not fit is not given.
    ctx.net.onMessage('devGive', (session, { item, count }) => {
      if (!ctx.net.devAuth) {
        ctx.log.debug({ session: session.id }, 'devGive ignored outside dev mode');
        return;
      }
      apply(session, 'devGive', (inventory) => {
        const added = addItems(inventory, items, { item, count });
        return added.left < count ? added.inventory : undefined;
      });
    });

    // Loot: what does not fit falls at the player's feet (anyone may take it at once).
    ctx.events.on('items.give', ({ entity, items: stacks }) => {
      let inventory = ctx.entities.get(entity, 'inventory');
      const position = ctx.entities.get(entity, 'position');
      if (!inventory || !position) {
        return;
      }
      for (const stack of stacks) {
        const added = addItems(inventory, items, stack);
        inventory = added.inventory;
        if (added.left > 0) {
          spawnGroundItem(ctx, position, { item: stack.item, count: added.left });
        }
      }
      update(entity, inventory);
    });

    // Death: a share of the gold carried falls where the player died, for anyone to take.
    ctx.events.on('entity.died', ({ entity, position }) => {
      const inventory = ctx.entities.get(entity, 'inventory');
      const lost = inventory ? deathGoldLoss(inventory.purse, ctx.config.survival) : 0;
      const left = inventory && lost > 0 ? takeGold(inventory, lost) : undefined;
      if (!left) {
        return;
      }
      update(entity, left);
      spawnGroundItem(ctx, position, { item: ctx.config.inventory.currencyItem, count: lost });
    });

    // Crafting, placing: an inventory another module computed from the current one.
    ctx.events.on('inventory.set', ({ entity, inventory }) => {
      if (ctx.entities.has(entity, 'inventory')) {
        update(entity, inventory);
      }
    });

    // Each hit with a tool wears it by one use; at 0 it breaks, and its owner is told.
    ctx.events.on('tool.used', ({ entity, item, slot }) => {
      const inventory = ctx.entities.get(entity, 'inventory');
      const worn = inventory?.slots[slot]?.item === item && wearItem(inventory, items, slot);
      if (!worn) {
        return;
      }
      update(entity, worn.inventory);
      if (worn.broken) {
        const session = ctx.net.allSessions().find((s) => s.player?.entity === entity);
        if (session) {
          ctx.net.send(session, { t: 'itemBroken', item });
        }
      }
    });

    // The "pick up" action: on purpose, so the wait of the player who dropped the pile does not apply.
    ctx.actions.register('pickUp', ({ entity, subject }) => {
      const inventory = ctx.entities.get(entity, 'inventory');
      if (subject.kind !== 'entity' || !inventory) {
        return 'unavailable';
      }
      if (!ctx.entities.has(subject.id, 'groundItem')) {
        return 'gone';
      }
      const next = takePile(ctx, inventory, subject.id);
      if (!next) {
        return 'inventoryFull';
      }
      update(entity, next);
      return undefined;
    });

    ctx.systems.add({
      name: 'inventory: pick up ground items',
      phase: 'simulate',
      run: () => pickUpGroundItems(ctx, (entity) => changed.add(entity)),
    });

    ctx.systems.add({
      name: 'inventory: send changes',
      phase: 'net',
      run: () => {
        if (changed.size === 0) {
          return;
        }
        for (const session of ctx.net.allSessions()) {
          const entity = session.player?.entity;
          const inventory =
            entity === undefined ? undefined : ctx.entities.get(entity, 'inventory');
          if (
            session.state === 'playing' &&
            entity !== undefined &&
            changed.has(entity) &&
            inventory
          ) {
            ctx.net.send(session, { t: 'inventory', ...inventory });
          }
        }
        changed.clear();
      },
    });

    ctx.scheduler.every(
      ctx.config.inventory.groundItemExpiryCheckMs,
      () => expireGroundItems(ctx),
      'remove old ground items',
    );
  },
};
