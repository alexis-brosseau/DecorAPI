import { Pool, DatabaseError } from 'pg';
import type { PoolClient } from 'pg';
import { config } from '../global.js';
import UserTable from './tables/user.js';
import CatanSessionTable from './tables/catan/catanSession.js';
import CatanGameTable from './tables/catan/catanGame.js';
import CatanGamePlayerTable from './tables/catan/catanGamePlayer.js';
import CatanGameStateTable from './tables/catan/catanGameState.js';
import CatanGameEventTable from './tables/catan/catanGameEvent.js';
import CatanChatMessageTable from './tables/catan/catanChatMessage.js';
import CatanTradeOfferTable from './tables/catan/catanTradeOffer.js';

const DB_POOL = new Pool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.pass,
  database: config.db.name,
  port: config.db.port,
});

export default class Database {
  public user: UserTable;
  public catanSession: CatanSessionTable;
  public catanGame: CatanGameTable;
  public catanGamePlayer: CatanGamePlayerTable;
  public catanGameState: CatanGameStateTable;
  public catanGameEvent: CatanGameEventTable;
  public catanChatMessage: CatanChatMessageTable;
  public catanTradeOffer: CatanTradeOfferTable;

  constructor(client: PoolClient) {
    this.user = new UserTable(client);
    this.catanSession = new CatanSessionTable(client);
    this.catanGame = new CatanGameTable(client);
    this.catanGamePlayer = new CatanGamePlayerTable(client);
    this.catanGameState = new CatanGameStateTable(client);
    this.catanGameEvent = new CatanGameEventTable(client);
    this.catanChatMessage = new CatanChatMessageTable(client);
    this.catanTradeOffer = new CatanTradeOfferTable(client);
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