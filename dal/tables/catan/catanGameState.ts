import type { PoolClient } from 'pg';
import type { UUID } from 'crypto';
import Table from '../../table.js';
import type { CatanGameState } from '../../models/catan.js';

export default class CatanGameStateTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'catan_game_state');
  }

  private mapRow(data: any): CatanGameState {
    return {
      gameId: data.game_id,
      version: Number(data.version),
      state: data.state,
      updatedAt: new Date(data.updated_at),
    };
  }

  async get(gameId: UUID): Promise<CatanGameState | null> {
    const sql = `
      SELECT game_id, version, state, updated_at
      FROM catan_game_state
      WHERE game_id = $1
      ORDER BY version DESC
    `;

    const rows = await super.query(sql, [gameId]);
    const data = rows[0];
    if (!data) return null;
    return this.mapRow(data);
  }

  async upsert(gameId: UUID, state: unknown): Promise<CatanGameState> {
    const sql = `
      INSERT INTO catan_game_state (game_id, version, state)
      VALUES ($1, 0, $2::jsonb)
      ON CONFLICT (game_id) DO UPDATE SET
        version = catan_game_state.version + 1,
        state = EXCLUDED.state,
        updated_at = now()
      RETURNING game_id, version, state, updated_at
    `;

    const rows = await super.query(sql, [gameId, JSON.stringify(state ?? {})]);
    const data = rows[0];
    if (!data) throw new Error('Failed to upsert game state');
    return this.mapRow(data);
  }
}
