import type { GameModule } from '../core/module';
import { chunksModule } from './chunks';
import { debugModule } from './debug';
import { playersModule } from './players';

/** Every module of the game server. They are initialized in dependency order. */
export const MODULES: readonly GameModule[] = [playersModule, chunksModule, debugModule];
