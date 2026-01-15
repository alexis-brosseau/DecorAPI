import type { PoolClient } from 'pg';
import Table from '../../table.js';
import type { CatanGame, CatanGameStatus } from '../../models/catan.js';

function generateJoinCode(length: number): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const base = chars.length;

  // Use current time in seconds for rolling codes
  // Each second produces a different code, ensuring uniqueness
  // Increasing code length captures finer time granularity
  const time = Math.floor(Date.now() / 1000);

  let code = '';
  let num = time;

  for (let i = 0; i < length; i++) {
    code = chars[num % base] + code;
    num = Math.floor(num / base);
  }

  return code;
}

export default class CatanGameTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'catan_game');
  }

  private mapRow(data: any): CatanGame {
    const status = data.status ?? 'lobby';

    return {
      id: data.id,
      joinCode: data.join_code,
      name: data.name ?? null,
      status,
      maxPlayers: Number(data.max_players),
      createdByUserId: data.created_by_user_id ?? null,
      createdAt: new Date(data.created_at),
      startedAt: data.started_at ? new Date(data.started_at) : null,
      finishedAt: data.finished_at ? new Date(data.finished_at) : null,
      seed: data.seed ?? null,
      config: data.config ?? {},
    };
  }

  async createLobby({
    name,
    maxPlayers,
    createdByUserId,
    seed,
    config,
  }: {
    name?: string | null;
    maxPlayers?: number;
    createdByUserId?: string | null;
    seed?: number | null;
    config?: unknown;
  }): Promise<CatanGame> {
    const sql = `
      INSERT INTO catan_game (join_code, name, max_players, created_by_user_id, seed, config)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb))
      RETURNING
        id, join_code, name, status, max_players, created_by_user_id,
        created_at, started_at, finished_at, seed, config
    `;

    const maxP = maxPlayers ?? 4;
    const codeLen = 6;

    for (let attempt = 0; attempt < 5; attempt++) {
      const joinCode = generateJoinCode(codeLen);
      try {
        const rows = await super.query(sql, [
          joinCode,
          name ?? null,
          maxP,
          createdByUserId ?? null,
          seed ?? null,
          JSON.stringify(config ?? {}),
        ]);
        const data = rows[0];
        if (!data) throw new Error('Failed to create game');
        return this.mapRow(data);
      } catch (error: any) {
        // 23505 = unique_violation (join_code collision)
        if (error?.code === '23505') continue;
        throw error;
      }
    }

    throw new Error('Failed to allocate join code');
  }

  async getById(id: string): Promise<CatanGame | null> {
    const sql = `
      SELECT
        id, join_code, name, status, max_players, created_by_user_id,
        created_at, started_at, finished_at, seed, config
      FROM catan_game
      WHERE id = $1
    `;

    const rows = await super.query(sql, [id]);
    const data = rows[0];
    if (!data) return null;
    return this.mapRow(data);
  }

  async getByJoinCode(joinCode: string): Promise<CatanGame | null> {
    const sql = `
      SELECT
        id, join_code, name, status, max_players, created_by_user_id,
        created_at, started_at, finished_at, seed, config
      FROM catan_game
      WHERE join_code = $1
    `;

    const rows = await super.query(sql, [joinCode]);
    const data = rows[0];
    if (!data) return null;
    return this.mapRow(data);
  }

  async setStatus(id: string, status: CatanGameStatus): Promise<CatanGame> {
    const sql = `
      UPDATE catan_game
      SET
        status = $2::catan_game_status,
        started_at = CASE WHEN $2::catan_game_status = 'running' THEN COALESCE(started_at, now()) ELSE started_at END,
        finished_at = CASE WHEN $2::catan_game_status IN ('finished','abandoned') THEN COALESCE(finished_at, now()) ELSE finished_at END
      WHERE id = $1
      RETURNING
        id, join_code, name, status, max_players, created_by_user_id,
        created_at, started_at, finished_at, seed, config
    `;

    const rows = await super.query(sql, [id, status]);
    const data = rows[0];
    if (!data) throw new Error('Failed to update game');
    return this.mapRow(data);
  }

  async listLobbies(limit: number = 50): Promise<CatanGame[]> {
    const sql = `
      SELECT
        id, join_code, name, status, max_players, created_by_user_id,
        created_at, started_at, finished_at, seed, config
      FROM catan_game
      WHERE status = 'lobby'
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const rows = await super.query(sql, [limit]);
    return rows.map(r => this.mapRow(r));
  }
}
