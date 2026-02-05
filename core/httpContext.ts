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
  token?: AccessTokenPayload;
}

export class InternalServerError extends Error {
  constructor(message = 'Internal Server Error') {
    super(message);
    this.name = 'InternalServerError';
  }
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

export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
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

export function ensureBody(body?: any) {
  if (!body) throw new BadRequestError('Body not found in HttpContext');
  return body;
}