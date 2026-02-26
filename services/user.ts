import { Database, executeWithDb } from 'express-decor/database';
import type { UUID } from 'crypto';
import { randomUUID } from 'crypto';
import type User from '../db/models/user.js';
import UserTable from '../db/tables/user.js';

export async function createUser(
  username: string,
  email: string,
  password: string,
  db?: Database,
): Promise<User> {
  return executeWithDb(async (db) => {
    return await db.table(UserTable).createUser({
      id: randomUUID(),
      username,
      email,
      password,
    });
  }, db);
}

export async function createGuest(
  username: string,
  db?: Database,
): Promise<User> {
  return executeWithDb(async (db) => {
    return await db.table(UserTable).createGuest({
      id: randomUUID(),
      username,
    });
  }, db);
}


export async function authUser(
  email: string,
  password: string,
  db?: Database
): Promise<User | null> {
  return executeWithDb(async (db) => {
    return await db.table(UserTable).auth(email, password);
  }, db);
}

export async function getUser(
  id: UUID,
  db?: Database
): Promise<User | null> {
  return executeWithDb(async (db) => {
    return await db.table(UserTable).get(id);
  }, db);
}
