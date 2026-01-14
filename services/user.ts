import type Database from '../dal/database.js';
import { executeWithDb } from '../core/utils/db.js';
import type { UUID } from 'crypto';
import type User from '../dal/models/user.js';

export async function createUser(
  username: string,
  email: string,
  password: string,
  db?: Database,
  id?: UUID
): Promise<User> {
  return executeWithDb(db, async (database) => {
    return await database.user.create({
      ...(id ? { id } : {}),
      username,
      email,
      password,
    });
  });
}

export async function authUser(
  email: string,
  password: string,
  db?: Database
): Promise<User | null> {
  return executeWithDb(db, async (database) => {
    return await database.user.auth(email, password);
  });
}

export async function getUser(
  id: UUID,
  db?: Database
): Promise<User | null> {
  return executeWithDb(db, async (database) => {
    return await database.user.get(id);
  });
}
