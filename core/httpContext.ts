import type { Request, Response } from 'express';
import type Database from '../dal/database.js';
import type { AccessTokenPayload } from './tokens.js';
import type { UUID } from 'crypto';

export default interface HttpContext {
  req: Request;
  res: Response;
  body?: any;
  query?: Record<string, any>;
  db?: Database;
  token?: AccessTokenPayload
  userId?: UUID | null;
  sessionId?: UUID | null;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class BadRequestError extends Error {
  constructor(message = 'Bad Request') {
    super(message);
    this.name = 'BadRequestError';
  }
}

export function ensureDb(db?: Database | null) {
  if (!db) throw new BadRequestError('Database not found in HttpContext');
  return db;
}

export function ensureToken(token?: AccessTokenPayload | null) {
  if (!token) throw new BadRequestError('Token not found in HttpContext');
  return token;
}

export function ensureQuery(query?: Record<string, any>) {
  if (!query) throw new BadRequestError('Query not found in HttpContext');
  return query;
}

export function ensureUser(userId?: UUID | null) {
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export function ensureIdentity(userId?: UUID | null, sessionId?: UUID | null):
  | { kind: 'user'; userId: UUID }
  | { kind: 'session'; sessionId: UUID } {
  if (userId) return { kind: 'user', userId };
  if (sessionId) return { kind: 'session', sessionId };
  throw new UnauthorizedError();
}

export function ensureRole(ctx: HttpContext, predicate: (token: AccessTokenPayload) => boolean) {
  if (!ctx.token) throw new UnauthorizedError();
  if (!predicate(ctx.token)) throw new ForbiddenError();
  return ctx.token;
}