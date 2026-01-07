import type { PoolClient } from 'pg';
import type { UUID } from 'crypto';
import Table from '../table.js';
import type { CatanGamePlayer, CatanPlayerColor } from '../models/catan.js';
import { catanPlayerColorFromString } from '../models/catan.js';

export default class CatanGamePlayerTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'catan_game_player');
  }

  private mapRow(data: any): CatanGamePlayer {
    return {
      id: data.id,
      gameId: data.game_id,
      userId: data.user_id ?? null,
      sessionId: data.session_id ?? null,

      seat: Number(data.seat),
      color: catanPlayerColorFromString(data.color ?? null),
      displayName: data.display_name,

      isHost: Boolean(data.is_host),
      isReady: Boolean(data.is_ready),
      isConnected: Boolean(data.is_connected),

      victoryPoints: Number(data.victory_points),
      playedKnights: Number(data.played_knights),
      longestRoadLength: Number(data.longest_road_length),
      largestArmy: Boolean(data.largest_army),
      longestRoad: Boolean(data.longest_road),

      createdAt: new Date(data.created_at),
    };
  }

  async listByGame(gameId: UUID): Promise<CatanGamePlayer[]> {
    const sql = `
      SELECT
        id, game_id, user_id, session_id, seat, color, display_name,
        is_host, is_ready, is_connected,
        victory_points, played_knights, longest_road_length, largest_army, longest_road,
        created_at
      FROM catan_game_player
      WHERE game_id = $1
      ORDER BY seat ASC
    `;

    const rows = await super.query(sql, [gameId]);
    return rows.map(r => this.mapRow(r));
  }

  async getByGameAndSession(gameId: UUID, sessionId: UUID): Promise<CatanGamePlayer | null> {
    const sql = `
      SELECT
        id, game_id, user_id, session_id, seat, color, display_name,
        is_host, is_ready, is_connected,
        victory_points, played_knights, longest_road_length, largest_army, longest_road,
        created_at
      FROM catan_game_player
      WHERE game_id = $1 AND session_id = $2
      LIMIT 1
    `;

    const rows = await super.query(sql, [gameId, sessionId]);
    const data = rows[0];
    if (!data) return null;
    return this.mapRow(data);
  }

  async getByGameAndUser(gameId: UUID, userId: UUID): Promise<CatanGamePlayer | null> {
    const sql = `
      SELECT
        id, game_id, user_id, session_id, seat, color, display_name,
        is_host, is_ready, is_connected,
        victory_points, played_knights, longest_road_length, largest_army, longest_road,
        created_at
      FROM catan_game_player
      WHERE game_id = $1 AND user_id = $2
      LIMIT 1
    `;

    const rows = await super.query(sql, [gameId, userId]);
    const data = rows[0];
    if (!data) return null;
    return this.mapRow(data);
  }

  async add({
    gameId,
    userId,
    sessionId,
    seat,
    color,
    displayName,
    isHost,
  }: {
    gameId: UUID;
    userId?: UUID | null;
    sessionId?: UUID | null;
    seat: number;
    color?: CatanPlayerColor | null;
    displayName: string;
    isHost?: boolean;
  }): Promise<CatanGamePlayer> {
    const sql = `
      INSERT INTO catan_game_player
        (game_id, user_id, session_id, seat, color, display_name, is_host)
      VALUES
        ($1, $2, $3, $4, $5::catan_player_color, $6, $7)
      RETURNING
        id, game_id, user_id, session_id, seat, color, display_name,
        is_host, is_ready, is_connected,
        victory_points, played_knights, longest_road_length, largest_army, longest_road,
        created_at
    `;

    const rows = await super.query(sql, [
      gameId,
      userId ?? null,
      sessionId ?? null,
      seat,
      color ?? null,
      displayName,
      isHost ?? false,
    ]);

    const data = rows[0];
    if (!data) throw new Error('Failed to add player');
    return this.mapRow(data);
  }

  async setReady(playerId: UUID, isReady: boolean): Promise<CatanGamePlayer> {
    const sql = `
      UPDATE catan_game_player
      SET is_ready = $2
      WHERE id = $1
      RETURNING
        id, game_id, user_id, session_id, seat, color, display_name,
        is_host, is_ready, is_connected,
        victory_points, played_knights, longest_road_length, largest_army, longest_road,
        created_at
    `;

    const rows = await super.query(sql, [playerId, isReady]);
    const data = rows[0];
    if (!data) throw new Error('Failed to update player');
    return this.mapRow(data);
  }

  async setConnected(playerId: UUID, isConnected: boolean): Promise<void> {
    const sql = `
      UPDATE catan_game_player
      SET is_connected = $2
      WHERE id = $1
    `;

    await super.query(sql, [playerId, isConnected]);
  }

  async setConnectedByGame(gameId: UUID, isConnected: boolean): Promise<void> {
    const sql = `
      UPDATE catan_game_player
      SET is_connected = $2
      WHERE game_id = $1
    `;

    await super.query(sql, [gameId, isConnected]);
  }
}
