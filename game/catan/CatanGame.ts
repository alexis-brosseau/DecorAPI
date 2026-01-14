import type { UUID } from 'crypto';
import type Database from '../../dal/database.js';
import { Game } from '../base/Game.js';
import type { ConnectionContext, RouteResult } from '../base/Game.js';

export type GamePhase = 'lobby' | 'starting' | 'play' | 'end';

function phaseFromStateRow(state: any): GamePhase {
  const phase = state?.state?.phase;
  if (phase === 'lobby' || phase === 'starting' || phase === 'play' || phase === 'end') return phase;
  return 'lobby';
}

function nextPhase(phase: GamePhase): GamePhase {
  switch (phase) {
    case 'lobby': return 'starting';
    case 'starting': return 'play';
    case 'play': return 'end';
    case 'end': return 'end';
  }
}

async function ensureInitialState(db: Database, gameId: UUID) {
  const existing = await (db as any).catanGameState.get(gameId);
  if (existing) return existing;
  return await (db as any).catanGameState.upsert(gameId, { phase: 'lobby' });
}

export default class CatanGame extends Game {
  async onConnect(db: Database, identity: any, gameId: UUID) {
    const game = await (db as any).catanGame.getById(gameId);
    if (!game) {
      const err = new Error('Game not found');
      (err as any).status = 404;
      throw err;
    }

    const player = identity.isUser()
      ? await (db as any).catanGamePlayer.getByGameAndUser(game.id, identity.id)
      : await (db as any).catanGamePlayer.getByGameAndSession(game.id, identity.id);

    if (!player) {
      const err = new Error('Player not found in game (call /join first)');
      (err as any).status = 403;
      throw err;
    }

    await (db as any).catanGamePlayer.setConnected(player.id, true);
    const state = await ensureInitialState(db, game.id);
    const players = await (db as any).catanGamePlayer.listByGame(game.id);

    return { game, players, state, phase: phaseFromStateRow(state), player };
  }

  async onDisconnect(db: Database, ctx: ConnectionContext): Promise<void> {
    await (db as any).catanGamePlayer.setConnected(ctx.playerId, false);
  }

  async routeMessage(db: Database, ctx: ConnectionContext, msg: any): Promise<RouteResult> {
    if (msg.type === 'ping') return { send: { type: 'pong' } };

    if (msg.type === 'player:setReady') {
      const updated = await (db as any).catanGamePlayer.setReady(ctx.playerId, Boolean(msg.isReady));
      const players = await (db as any).catanGamePlayer.listByGame(updated.gameId);
      return { broadcast: { type: 'players:update', players } };
    }

    if (msg.type === 'game:advancePhase') {
      const players = await (db as any).catanGamePlayer.listByGame(ctx.gameId);
      const me = players.find((p: any) => p.id === ctx.playerId);
      if (!me) {
        const err = new Error('Player not found');
        (err as any).status = 404;
        throw err;
      }
      if (!me.isHost) {
        const err = new Error('Host only');
        (err as any).status = 403;
        throw err;
      }

      const stateRow = await ensureInitialState(db, ctx.gameId);
      const current = phaseFromStateRow(stateRow);
      const phase = nextPhase(current);

      if (current === 'lobby') {
        const hasEnoughPlayers = players.length >= 2;
        const everyoneReady = players.length > 0 && players.every((p: any) => p.isReady);
        if (!hasEnoughPlayers || !everyoneReady) {
          const err = new Error('All players must be ready');
          (err as any).status = 409;
          throw err;
        }
        await (db as any).catanGame.setStatus(ctx.gameId, 'running');
      }

      let closeRoom = false;
      if (phase === 'end') {
        await (db as any).catanGame.setStatus(ctx.gameId, 'finished');
        await (db as any).catanGamePlayer.setConnectedByGame(ctx.gameId, false);
        closeRoom = true;
      }

      const newState = { ...(stateRow.state ?? {}), phase };
      const updated = await (db as any).catanGameState.upsert(ctx.gameId, newState);
      const updatedPlayers = await (db as any).catanGamePlayer.listByGame(ctx.gameId);

      return { broadcast: { type: 'phase:update', phase, state: updated, players: updatedPlayers }, closeRoom };
    }

    return { send: { type: 'error', message: 'Unknown message' } };
  }
}
