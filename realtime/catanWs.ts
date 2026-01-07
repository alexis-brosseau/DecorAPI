import type http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { transaction } from '../dal/database.js';
import type { UUID } from 'crypto';
import type { GamePhase } from '../services/game.js';
import { verifyAccessToken } from '../core/tokens.js';
import {
  connectWebSocket,
  disconnectWebSocket,
  setPlayerReady,
  advanceGamePhase,
} from '../services/game.js';

type ClientMessage =
  | { type: 'ping' }
  | { type: 'player:setReady'; isReady: boolean }
  | { type: 'game:advancePhase' };

type ServerMessage =
  | { type: 'error'; message: string }
  | { type: 'pong' }
  | { type: 'snapshot'; game: any; players: any[]; state: any; phase: GamePhase; you: { playerId: string } }
  | { type: 'players:update'; players: any[] }
  | { type: 'phase:update'; phase: GamePhase; state: any; players: any[] }
  | { type: 'game:ended' };

type SocketCtx = {
  gameId: UUID;
  playerId: UUID;
};

function parseQuery(req: http.IncomingMessage) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const gameId = (url.searchParams.get('gameId') ?? '') as any;
  const accessToken = url.searchParams.get('accessToken') ?? '';
  return { gameId, accessToken };
}

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

function broadcast(peers: Set<WebSocket>, msg: ServerMessage) {
  for (const ws of peers) send(ws, msg);
}

export function attachCatanWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/catan' });

  const rooms = new Map<string, Set<WebSocket>>();
  const ctxBySocket = new WeakMap<WebSocket, SocketCtx>();

  const getRoom = (gameId: string) => {
    let set = rooms.get(gameId);
    if (!set) {
      set = new Set<WebSocket>();
      rooms.set(gameId, set);
    }
    return set;
  };

  async function broadcastPlayers(gameId: UUID) {
    const peers = rooms.get(gameId as any);
    if (!peers || peers.size === 0) return;

    await transaction(async (db) => {
      const players = await db.catanGamePlayer.listByGame(gameId);
      broadcast(peers, { type: 'players:update', players });
    });
  }

  async function closeRoom(gameId: UUID) {
    const peers = rooms.get(gameId as any);
    if (!peers) return;

    broadcast(peers, { type: 'game:ended' });
    for (const ws of peers) {
      try {
        ws.close(1000, 'game ended');
      } catch {
        // ignore
      }
    }
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
      const snapshot = await transaction(async (db) => {
        return await connectWebSocket({
          gameId,
          userId: (token as any).userId ?? null,
          sessionId: (token as any).sessionId ?? null,
        }, db);
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

      await broadcastPlayers(snapshot.game.id);
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

      if (msg.type === 'ping') {
        send(ws, { type: 'pong' });
        return;
      }

      try {
        if (msg.type === 'player:setReady') {
          await transaction(async (db) => {
            const players = await setPlayerReady(ctx.playerId, Boolean(msg.isReady), db);
            const peers = rooms.get(ctx.gameId as any);
            if (peers) broadcast(peers, { type: 'players:update', players });
          });
          return;
        }

        if (msg.type === 'game:advancePhase') {
          const result = await transaction(async (db) => {
            return await advanceGamePhase({ gameId: ctx.gameId, playerId: ctx.playerId }, db);
          });

          const peers = rooms.get(ctx.gameId as any);
          if (peers) {
            broadcast(peers, { type: 'phase:update', phase: result.phase, state: result.state, players: result.players });
          }

          if (result.phase === 'end') {
            await closeRoom(ctx.gameId);
          }

          return;
        }

        send(ws, { type: 'error', message: 'Unknown message' });
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
        await transaction(async (db) => {
          await disconnectWebSocket(ctx.playerId, db);
        });
      } catch {
        // ignore
      }

      await broadcastPlayers(ctx.gameId);
    });

    ws.on('error', async () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    });
  });
}
