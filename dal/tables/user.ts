import Table from '../table.js';
import type User from '../models/user.js';
import type { PoolClient } from 'pg';
import type { UUID } from 'crypto';
import { UserRole } from '../models/user.js';
import { dbErr } from '../../global.js';

export default class UserTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'user');
  }

  private mapRow(data: any): User {
    return {
      id: data.id,
      username: data.username,
      role: UserRole.fromString(data.role) || data.role,
      email: data.email,
      tokenVersion: data.token_version,
      createdAt: new Date(data.created_at),
    };
  }

  async get(id: UUID): Promise<User | null> {
    const data = await super.get(id);
    if (!data) return null;
    return this.mapRow(data);
  }

  async createUser({ id, username, email, password }: { 
    id: UUID; 
    username: string; 
    email: string; 
    password: string; 
  }): Promise<User> {
    const sql = `
      INSERT INTO "user" (id, username, role, email, hash)
      VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf')))
      RETURNING id, username, email, role, token_version, created_at
    `;

    try {
      const rows = await super.query(sql, [id, username, UserRole.USER.toString(), email, password]);
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

  async createGuest({ id, username }: { 
    id: UUID; 
    username: string; 
  }): Promise<User> {
    const sql = `
      INSERT INTO "user" (id, username, role)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, role, token_version, created_at
    `;

    const rows = await super.query(sql, [id, username, UserRole.GUEST.toString()]);
    const data = rows[0];
    if (!data) throw new Error('Failed to create guest user');
    
    return this.mapRow(data);
  }
  
  async auth(email: string, password: string): Promise<User | null> {
    const sql = `
      SELECT id, username, email, role, token_version, created_at
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