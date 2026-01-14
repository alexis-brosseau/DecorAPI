import type { UUID } from 'crypto';
import type Database from '../../dal/database.js';
import type { Identity } from '../../core/identity.js';

export type WsClientMessage = any;
export type WsServerMessage = any;

export type ConnectionContext = {
  gameId: UUID;
  playerId: UUID;
};

export type ConnectSnapshot = {
  game: any;
  players: any[];
  state: any;
  phase?: string;
  player: any;
};

export type RouteResult = {
  send?: WsServerMessage;
  broadcast?: WsServerMessage;
  closeRoom?: boolean;
};

export abstract class Game {
  /** Called on WS connect. Should mark player connected and return a snapshot. */
  abstract onConnect(db: Database, identity: Identity, gameId: UUID): Promise<ConnectSnapshot>;

  /** Called on WS disconnect. Should mark player disconnected. */
  abstract onDisconnect(db: Database, ctx: ConnectionContext): Promise<void>;

  /** Route an incoming client message. */
  abstract routeMessage(db: Database, ctx: ConnectionContext, msg: WsClientMessage): Promise<RouteResult>;
}
