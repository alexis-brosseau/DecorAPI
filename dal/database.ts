import { Pool, DatabaseError } from 'pg';
import type { PoolClient } from 'pg';
import { config } from '../global.js';
import UserTable from './tables/user.js';
import CatanGameTable from './tables/catan/catanGame.js';
import CatanGamePlayerTable from './tables/catan/catanGamePlayer.js';
import CatanGameStateTable from './tables/catan/catanGameState.js';
import CatanChatMessageTable from './tables/catan/catanChatMessage.js';

const DB_POOL = new Pool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.pass,
  database: config.db.name,
  port: config.db.port,
});

export default class Database {
  public user: UserTable;
  public catanGame: CatanGameTable;
  public catanGamePlayer: CatanGamePlayerTable;
  public catanGameState: CatanGameStateTable;
  public catanChatMessage: CatanChatMessageTable;

  constructor(client: PoolClient) {
    this.user = new UserTable(client);
    this.catanGame = new CatanGameTable(client);
    this.catanGamePlayer = new CatanGamePlayerTable(client);
    this.catanGameState = new CatanGameStateTable(client);
    this.catanChatMessage = new CatanChatMessageTable(client);
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