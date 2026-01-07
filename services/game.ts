import type { UUID } from 'crypto';
import { randomUUID } from 'crypto';
import type Database from '../dal/database.js';
import { executeWithDb } from '../core/utils/db.js';
import type { CatanGame, CatanGamePlayer, CatanGameState } from '../dal/models/catan.js';

export type GamePhase = 'lobby' | 'starting' | 'play' | 'end';

function defaultGuestName(): string {
  return `Guest-${randomUUID().slice(0, 6)}`;
}

function phaseFromStateRow(state: CatanGameState | null): GamePhase {
  const phase = (state?.state as any)?.phase;
  if (phase === 'lobby' || phase === 'starting' || phase === 'play' || phase === 'end') return phase;
  return 'lobby';
}

function nextPhase(phase: GamePhase): GamePhase {
  switch (phase) {
    case 'lobby':
      return 'starting';
    case 'starting':
      return 'play';
    case 'play':
      return 'end';
    case 'end':
      return 'end';
  }
}

async function ensureInitialState(db: Database, gameId: UUID): Promise<CatanGameState> {
  const existing = await db.catanGameState.get(gameId);
  if (existing) return existing;
  return await db.catanGameState.upsert(gameId, { phase: 'lobby' });
}

export async function listLobbies(limit: number = 50, db?: Database): Promise<CatanGame[]> {
  return executeWithDb(db, async (database) => {
    return await database.catanGame.listLobbies(limit);
  });
}

export async function createLobby(
  {
    name,
    maxPlayers,
    userId,
  }: {
    name?: string | null;
    maxPlayers?: number;
    userId?: UUID | null;
  },
  db?: Database
): Promise<CatanGame> {
  return executeWithDb(db, async (database) => {
    return await database.catanGame.createLobby({
      name: name ?? null,
      maxPlayers: maxPlayers ?? 4,
      createdByUserId: (userId as any) ?? null,
      config: {},
    });
  });
}

export async function joinLobby(
  {
    joinCode,
    gameId,
    displayName,
    userId,
    sessionId,
  }: {
    joinCode?: string;
    gameId?: UUID;
    displayName?: string;
    userId?: UUID | null;
    sessionId?: UUID | null;
  },
  db?: Database
): Promise<{
  game: CatanGame;
  player: CatanGamePlayer;
  ws: { path: string; query: { gameId: UUID; accessToken?: string } };
}> {
  return executeWithDb(db, async (database) => {
    const identity = userId
      ? ({ kind: 'user' as const, userId } as const)
      : sessionId
        ? ({ kind: 'session' as const, sessionId } as const)
        : null;

    if (!identity) {
      const err = new Error('Authentication required');
      (err as any).status = 401;
      throw err;
    }

    const game = gameId
      ? await database.catanGame.getById(gameId as any)
      : joinCode
        ? await database.catanGame.getByJoinCode(joinCode)
        : null;

    if (!game) {
      const err = new Error('Lobby not found');
      (err as any).status = 404;
      throw err;
    }

    // Reuse existing player by identity (user or session)
    let player: CatanGamePlayer | null = identity.kind === 'user'
      ? await database.catanGamePlayer.getByGameAndUser(game.id, identity.userId)
      : await database.catanGamePlayer.getByGameAndSession(game.id, identity.sessionId);

    if (!player) {
      const players: CatanGamePlayer[] = await database.catanGamePlayer.listByGame(game.id);
      if (players.length >= game.maxPlayers) {
        const err = new Error('Lobby is full');
        (err as any).status = 409;
        throw err;
      }

      const nextSeat = players.length === 0 ? 1 : Math.max(...players.map(p => p.seat)) + 1;
      const isHost = players.length === 0;

      player = await database.catanGamePlayer.add({
        gameId: game.id,
        userId: identity.kind === 'user' ? (identity.userId as any) : null,
        sessionId: identity.kind === 'session' ? (identity.sessionId as any) : null,
        seat: nextSeat,
        displayName: displayName ?? defaultGuestName(),
        isHost,
      });
    }

    if (!player) {
      const err = new Error('Failed to create or reuse player');
      (err as any).status = 500;
      throw err;
    }

    // Player is not connected until WS connects
    await database.catanGamePlayer.setConnected(player.id, false);

    // Ensure a state exists early, so lobby always has a phase
    await ensureInitialState(database, game.id);

    return {
      game,
      player,
      ws: { path: '/ws/catan', query: { gameId: game.id } },
    };
  });
}

export async function connectWebSocket(
  {
    gameId,
    userId,
    sessionId,
  }: {
    gameId: UUID;
    userId?: UUID | null;
    sessionId?: UUID | null;
  },
  db: Database
): Promise<{
  game: CatanGame;
  players: CatanGamePlayer[];
  state: CatanGameState;
  phase: GamePhase;
  player: CatanGamePlayer;
}> {
  const game = await db.catanGame.getById(gameId as any);
  if (!game) {
    const err = new Error('Game not found');
    (err as any).status = 404;
    throw err;
  }

  const identity = userId
    ? ({ kind: 'user' as const, userId } as const)
    : sessionId
      ? ({ kind: 'session' as const, sessionId } as const)
      : null;

  if (!identity) {
    const err = new Error('Authentication required');
    (err as any).status = 401;
    throw err;
  }

  const player = identity.kind === 'user'
    ? await db.catanGamePlayer.getByGameAndUser(game.id, identity.userId)
    : await db.catanGamePlayer.getByGameAndSession(game.id, identity.sessionId);

  if (!player) {
    const err = new Error('Player not found in game (call /join first)');
    (err as any).status = 403;
    throw err;
  }

  await db.catanGamePlayer.setConnected(player.id, true);

  const state = await ensureInitialState(db, game.id);
  const players = await db.catanGamePlayer.listByGame(game.id);

  return { game, players, state, phase: phaseFromStateRow(state), player };
}

export async function disconnectWebSocket(playerId: UUID, db: Database): Promise<void> {
  await db.catanGamePlayer.setConnected(playerId, false);
}

export async function setPlayerReady(playerId: UUID, isReady: boolean, db: Database): Promise<CatanGamePlayer[]> {
  const updated = await db.catanGamePlayer.setReady(playerId, isReady);
  return await db.catanGamePlayer.listByGame(updated.gameId);
}

export async function advanceGamePhase(
  {
    gameId,
    playerId,
  }: {
    gameId: UUID;
    playerId: UUID;
  },
  db: Database
): Promise<{ phase: GamePhase; state: CatanGameState; players: CatanGamePlayer[] }>{
  const players = await db.catanGamePlayer.listByGame(gameId);
  const me = players.find(p => p.id === playerId);
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

  const stateRow = await ensureInitialState(db, gameId);
  const current = phaseFromStateRow(stateRow);
  const phase = nextPhase(current);

  if (current === 'lobby') {
    const hasEnoughPlayers = players.length >= 2;
    const everyoneReady = players.length > 0 && players.every(p => p.isReady);
    if (!hasEnoughPlayers || !everyoneReady) {
      const err = new Error('All players must be ready');
      (err as any).status = 409;
      throw err;
    }
    await db.catanGame.setStatus(gameId as any, 'running');
  }

  if (phase === 'end') {
    await db.catanGame.setStatus(gameId as any, 'finished');
    await db.catanGamePlayer.setConnectedByGame(gameId, false);
  }

  const newState = { ...((stateRow.state as any) ?? {}), phase };
  const updated = await db.catanGameState.upsert(gameId, newState);

  const updatedPlayers = await db.catanGamePlayer.listByGame(gameId);
  return { phase, state: updated, players: updatedPlayers };
}
