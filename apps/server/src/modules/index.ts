import type { GameModule } from '../core/module';
import { buildingModule } from './building';
import { chatModule } from './chat';
import { chunksModule } from './chunks';
import { combatModule } from './combat';
import { craftingModule } from './crafting';
import { debugModule } from './debug';
import { harvestModule } from './harvest';
import { interactionModule } from './interaction';
import { inventoryModule } from './inventory';
import { movementModule } from './movement';
import { persistenceModule } from './persistence';
import { playersModule } from './players';
import { skinsModule } from './skins';
import { snapshotsModule } from './snapshots';
import { survivalModule } from './survival';
import { timeModule } from './time';

/** Every module of the game server. They are initialized in dependency order. */
export const MODULES: readonly GameModule[] = [
  playersModule,
  timeModule,
  movementModule,
  chunksModule,
  snapshotsModule,
  persistenceModule,
  chatModule,
  skinsModule,
  inventoryModule,
  interactionModule,
  harvestModule,
  craftingModule,
  buildingModule,
  survivalModule,
  combatModule,
  debugModule,
];
