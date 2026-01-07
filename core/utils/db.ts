import type Database from '../../dal/database.js';
import { transaction } from '../../dal/database.js';

/**
 * Executes a database operation either within an existing transaction or creates a new one.
 * @param db Optional database instance from an existing transaction
 * @param callback Function to execute with the database instance
 * @returns The result of the callback
 */
export async function executeWithDb<T>(
  db: Database | undefined,
  callback: (db: Database) => Promise<T>
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
