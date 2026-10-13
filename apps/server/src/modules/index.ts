import type { GameModule } from '../core/module';
import { chatModule } from './chat';
import { chunksModule } from './chunks';
import { debugModule } from './debug';
import { movementModule } from './movement';
import { persistenceModule } from './persistence';
import { playersModule } from './players';
import { snapshotsModule } from './snapshots';

/** Every module of the game server. They are initialized in dependency order. */
export const MODULES: readonly GameModule[] = [
  playersModule,
  movementModule,
  chunksModule,
  snapshotsModule,
  persistenceModule,
  chatModule,
  debugModule,
];
