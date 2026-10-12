import { PROTOCOL_VERSION_SENT, SERVER_URL } from '../env';
import { GameClient } from './GameClient';

/** The connection to the game server, shared by the whole client. */
export const gameClient = new GameClient({
  serverUrl: SERVER_URL,
  protocolVersion: PROTOCOL_VERSION_SENT,
});
