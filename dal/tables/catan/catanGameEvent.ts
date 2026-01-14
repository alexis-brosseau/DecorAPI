import type { PoolClient } from 'pg';
import type { UUID } from 'crypto';
import Table from '../../table.js';
import type { CatanGameEvent } from '../../models/catan.js';

export default class CatanGameEventTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'catan_game_event');
  }

  private mapRow(data: any): CatanGameEvent {
    return {
      id: Number(data.id),
      gameId: data.game_id,
      seq: Number(data.seq),
      playerId: data.player_id ?? null,
      type: data.type,
      payload: data.payload,
      createdAt: new Date(data.created_at),
    };
  }

  async listByGame(gameId: UUID, limit: number = 200): Promise<CatanGameEvent[]> {
    const sql = `
      SELECT id, game_id, seq, player_id, type, payload, created_at
      FROM catan_game_event
      WHERE game_id = $1
      ORDER BY seq ASC
      LIMIT $2
    `;

    const rows = await super.query(sql, [gameId, limit]);
    return rows.map((r) => this.mapRow(r));
  }

  async append({
    gameId,
    playerId,
    type,
    payload,
  }: {
    gameId: UUID;
    playerId?: UUID | null;
    type: string;
    payload: unknown;
  }): Promise<CatanGameEvent> {
    const sql = `
      INSERT INTO catan_game_event (game_id, player_id, type, payload)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING id, game_id, seq, player_id, type, payload, created_at
    `;

    const rows = await super.query(sql, [gameId, playerId ?? null, type, JSON.stringify(payload ?? null)]);
    const data = rows[0];
    if (!data) throw new Error('Failed to append game event');
    return this.mapRow(data);
  }
}
