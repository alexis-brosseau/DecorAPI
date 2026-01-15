import type { UUID } from 'crypto';
import type Database from '../dal/database.js';
import { executeWithDb } from '../core/utils/db.js';
import type { CatanGame, CatanGamePlayer } from '../dal/models/catan.js';
import type { Identity } from '../core/identity.js';
import { ConflictError, NotFoundError } from '../core/httpContext.js';

function defaultGuestName(id: string): string {
  return `Guest-${id.slice(0, 6)}`;
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
    identity,
  }: {
    joinCode?: string;
    gameId?: UUID;
    identity: Identity;
  },
  db?: Database
): Promise<{
  game: CatanGame;
  player: CatanGamePlayer;
  ws: { path: string; query: { gameId: UUID; accessToken?: string } };
}> {
  return executeWithDb(db, async (database) => {
    const game = gameId
      ? await database.catanGame.getById(gameId as any)
      : joinCode
        ? await database.catanGame.getByJoinCode(joinCode)
        : null;

    if (!game) {
      throw new NotFoundError('Lobby not found');
    }

    // Reuse existing player by identity (user or guest)
    let player: CatanGamePlayer | null = await database.catanGamePlayer.getByIdentity(game.id, identity);

    if (!player) {
      const players: CatanGamePlayer[] = await database.catanGamePlayer.listByGame(game.id);
      if (players.length >= game.maxPlayers) {
        throw new ConflictError('Lobby is full');
      }

      const nextSeat = players.length === 0 ? 1 : Math.max(...players.map(p => p.seat)) + 1;
      const isHost = players.length === 0;
      const user = identity.isUser() ? await database.user.get(identity.id as any) : null;

      player = await database.catanGamePlayer.add({
        gameId: game.id,
        userId: user?.id ?? null,
        guestId: identity.isGuest() ? (identity.id as any) : null,
        seat: nextSeat,
        displayName: user?.id ?? defaultGuestName(identity.id),
        isHost,
      });
    }

    if (!player) {
      throw new Error('Failed to create or reuse player');
    }

    return {
      game,
      player,
      ws: { path: '/ws/catan', query: { gameId: game.id } },
    };
  });
}