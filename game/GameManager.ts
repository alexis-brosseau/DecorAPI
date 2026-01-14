import type http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { transaction } from '../dal/database.js';
import type { UUID } from 'crypto';
import { verifyAccessToken } from '../core/tokens.js';
import { Identity } from '../core/identity.js';
import type Database from '../dal/database.js';
import type { Game, ConnectionContext, RouteResult } from './base/Game.js';

type ClientMessage = any;
type ServerMessage = any;

type Registration = {
  path: string;
  create: () => Game;
};

function safeJsonParse<T>(raw: WebSocket.RawData): T | null {
  try {
    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

export default class GameManager {
  private registrations: Registration[] = [];

  register(path: string, create: () => Game) {
    this.registrations.push({ path, create });
  }

  attach(server: http.Server) {
    for (const reg of this.registrations) {
      this.attachRoute(server, reg);
    }
  }

  private attachRoute(server: http.Server, reg: Registration) {
    const wss = new WebSocketServer({ server, path: reg.path });
    const game = reg.create();

    const rooms = new Map<string, Set<WebSocket>>();
    const ctxBySocket = new WeakMap<WebSocket, ConnectionContext>();

    const getRoom = (gameId: string) => {
      let set = rooms.get(gameId);
      if (!set) {
        set = new Set<WebSocket>();
        rooms.set(gameId, set);
      }
      return set;
    };

    async function broadcast(gameId: UUID, msg: ServerMessage) {
      const peers = rooms.get(gameId as any);
      if (!peers || peers.size === 0) return;
      for (const ws of peers) send(ws, msg);
    }

    function parseQuery(req: http.IncomingMessage) {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const gameId = (url.searchParams.get('gameId') ?? '') as any;
      const accessToken = url.searchParams.get('accessToken') ?? '';
      return { gameId, accessToken } as { gameId: UUID; accessToken: string };
    }

    async function withDb<T>(fn: (db: Database) => Promise<T>): Promise<T> {
      return await transaction(async (db) => fn(db));
    }

    wss.on('connection', async (ws, req) => {
      const { gameId, accessToken } = parseQuery(req);

      if (!gameId || !accessToken) {
        send(ws, { type: 'error', message: 'Missing gameId or accessToken' });
        ws.close(1008, 'invalid params');
        return;
      }

      const token = verifyAccessToken(accessToken);
      if (!token) {
        send(ws, { type: 'error', message: 'Invalid or expired accessToken' });
        ws.close(1008, 'unauthorized');
        return;
      }

      try {
        const identity = Identity.require(
          (token as any).userId ?? null,
          (token as any).sessionId ?? null,
          (token as any).role
        );

        const snapshot = await withDb(async (db) => {
          return await game.onConnect(db, identity, gameId);
        });

        ctxBySocket.set(ws, { gameId: snapshot.game.id, playerId: snapshot.player.id });
        getRoom(snapshot.game.id as any).add(ws);

        send(ws, {
          type: 'snapshot',
          game: snapshot.game,
          players: snapshot.players,
          state: snapshot.state,
          phase: snapshot.phase,
          you: { playerId: snapshot.player.id as any },
        });

        // Allow the game to drive additional lobby updates if needed.
        await broadcast(snapshot.game.id, { type: 'players:update', players: snapshot.players });
      } catch (e: any) {
        send(ws, { type: 'error', message: e?.message ?? 'Failed to connect' });
        ws.close(1008, 'connect failed');
        return;
      }

      ws.on('message', async (raw) => {
        const ctx = ctxBySocket.get(ws);
        if (!ctx) {
          send(ws, { type: 'error', message: 'Not initialized' });
          return;
        }

        const msg = safeJsonParse<ClientMessage>(raw);
        if (!msg || typeof (msg as any).type !== 'string') {
          send(ws, { type: 'error', message: 'Invalid message' });
          return;
        }

        try {
          const res: RouteResult = await withDb(async (db) => {
            return await game.routeMessage(db, ctx, msg);
          });

          if (res.send) send(ws, res.send);
          if (res.broadcast) await broadcast(ctx.gameId, res.broadcast);
          if (res.closeRoom) {
            const peers = rooms.get(ctx.gameId as any);
            if (peers) {
              for (const s of peers) send(s, { type: 'game:ended' });
              for (const s of peers) {
                try { s.close(1000, 'game ended'); } catch {}
              }
              rooms.delete(ctx.gameId as any);
            }
          }
        } catch (e: any) {
          send(ws, { type: 'error', message: e?.message ?? 'Server error' });
        }
      });

      ws.on('close', async () => {
        const ctx = ctxBySocket.get(ws);
        if (!ctx) return;

        const peers = rooms.get(ctx.gameId as any);
        if (peers) {
          peers.delete(ws);
          if (peers.size === 0) rooms.delete(ctx.gameId as any);
        }

        try {
          await withDb(async (db) => {
            await game.onDisconnect(db, ctx);
          });
        } catch {}
      });

      ws.on('error', async () => {
        try { ws.close(); } catch {}
      });
    });
  }
}
