import { Pool, DatabaseError } from 'pg';
import type { PoolClient } from 'pg';
import { config } from '../global.js';
import UserTable from './tables/user.js';

const DB_POOL = new Pool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.pass,
  database: config.db.name,
  port: config.db.port,
});

export default class Database {
  public user: UserTable;

  constructor(client: PoolClient) {
    this.user = new UserTable(client);
  }
}

export async function transaction<T>(callback: (db: Database) => Promise<T>): Promise<T> {
  const client = await DB_POOL.connect();
  try {
    await client.query('BEGIN');
    const db = new Database(client);
    const result = await callback(db);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  finally {
    client.release();
  }
};

/**
 * Executes a database operation either within an existing transaction or creates a new one.
 * @param db Optional database instance from an existing transaction
 * @param callback Function to execute with the database instance
 * @returns The result of the callback
 */
export async function executeWithDb<T>(
  callback: (db: Database) => Promise<T>,
  db?: Database
): Promise<T> {
  if (db) {
    // Use existing transaction/connection
    return await callback(db);
  } else {
    // Create new transaction
    let result: T;
    await transaction(async (database) => {
      result = await callback(database);
    });
    return result!;
  }
}