import Table from '../table.js';
import type User from '../models/user.js';
import type { PoolClient, DatabaseError } from 'pg';
import { createHash, type UUID } from 'crypto';
import { UserRole } from '../models/user.js';
import { dbErr } from '../../global.js';

export default class UserTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'user');
  }

  private mapRow(data: any): User {
    return {
      id: data.id,
      name: data.name,
      surname: data.surname,
      email: data.email,
      role: UserRole.fromString(data.role) || UserRole.USER,
      tokenVersion: data.token_version,
      createdAt: new Date(data.created_at),
    };
  }

  async get(id: UUID): Promise<User | null> {
    const data = await super.get(id);
    if (!data) return null;
    return this.mapRow(data);
  }

  async create({ id, name, surname, email, password }: { id?: UUID; name: string; surname: string; email: string; password: string; }): Promise<User> {
    const sql = `
      INSERT INTO "user" (id, name, surname, email, hash)
      VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf')))
      RETURNING id, name, surname, email, role, token_version, created_at
    `;

    try {
      const rows = await super.query(sql, [id || null, name, surname, email, password]);
      const data = rows[0];
      if (!data) throw new Error('Failed to create user');
      
      return this.mapRow(data);
    } catch (error: any) {
      if (error.code === dbErr.uniqueViolation) {
        error.message = `Email ${email} already exists`;
      }
      throw error;
    }
  }

  async auth(email: string, password: string): Promise<User | null> {
    const sql = `
      SELECT id, name, surname, email, role, token_version, created_at
      FROM "user"
      WHERE email = $1
        AND hash = crypt($2, hash)
    `;

    const rows = await super.query(sql, [email, password]);
    const data = rows[0];
    if (!data) return null;
    
    return this.mapRow(data);
  }
}