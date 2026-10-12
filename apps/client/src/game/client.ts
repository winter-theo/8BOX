import { PROTOCOL_VERSION_SENT, SERVER_URL } from '../env';
import { content } from './content';
import { eventBus } from './events';
import { GameClient } from './GameClient';

/** The connection to the game server, shared by the whole client. */
export const gameClient = new GameClient({
  serverUrl: SERVER_URL,
  content,
  bus: eventBus,
  protocolVersion: PROTOCOL_VERSION_SENT,
});
