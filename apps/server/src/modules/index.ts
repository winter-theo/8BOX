import type { GameModule } from '../core/module';
import { debugModule } from './debug';

/** Every module of the game server. They are initialized in dependency order. */
export const MODULES: readonly GameModule[] = [debugModule];
