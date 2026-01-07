import type { PoolClient } from 'pg';
import type { UUID } from 'crypto';
import { createHash } from 'crypto';
import Table from '../table.js';
import type { CatanSession } from '../models/catan.js';

export default class CatanSessionTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'catan_session');
  }

  private mapRow(data: any): CatanSession {
    return {
      id: data.id,
      tokenHash: data.token_hash,
      createdAt: new Date(data.created_at),
      lastSeenAt: new Date(data.last_seen_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    };
  }

  async create({ token, expiresAt }: { token: string; expiresAt?: Date | null; }): Promise<CatanSession> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const sql = `
      INSERT INTO catan_session (token_hash, expires_at)
      VALUES ($1, $2)
      RETURNING id, token_hash, created_at, last_seen_at, expires_at
    `;

    const rows = await super.query(sql, [tokenHash, expiresAt ?? null]);
    const data = rows[0];
    if (!data) throw new Error('Failed to create session');
    return this.mapRow(data);
  }

  async touch(id: UUID): Promise<void> {
    const sql = `
      UPDATE catan_session
      SET last_seen_at = now()
      WHERE id = $1
    `;

    await super.query(sql, [id]);
  }

  async get(id: UUID): Promise<CatanSession | null> {
    const sql = `
      SELECT id, token_hash, created_at, last_seen_at, expires_at
      FROM catan_session
      WHERE id = $1
    `;

    const rows = await super.query(sql, [id]);
    const data = rows[0];
    if (!data) return null;
    return this.mapRow(data);
  }

  async getByTokenHash(tokenHash: string): Promise<CatanSession | null> {
    const sql = `
      SELECT id, token_hash, created_at, last_seen_at, expires_at
      FROM catan_session
      WHERE token_hash = $1
    `;

    const rows = await super.query(sql, [tokenHash]);
    const data = rows[0];
    if (!data) return null;
    return this.mapRow(data);
  }

  async getByToken(token: string): Promise<CatanSession | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return await this.getByTokenHash(tokenHash);
  }
}
