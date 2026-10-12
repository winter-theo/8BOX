import { PROTOCOL_VERSION_SENT, SERVER_URL, SIMULATED_LAG_MS } from '../env';
import { content } from './content';
import { eventBus } from './events';
import { GameClient } from './GameClient';

/** The connection to the game server, shared by the whole client. */
export const gameClient = new GameClient({
  serverUrl: SERVER_URL,
  content,
  bus: eventBus,
  protocolVersion: PROTOCOL_VERSION_SENT,
  lagMs: SIMULATED_LAG_MS,
});
