import type { UUID } from 'crypto';
import type { UserRole } from '../dal/models/user.js';
import { config } from '../global.js';
import jwt from 'jsonwebtoken';

export interface RefreshTokenPayload {
  userId: UUID;
  version: number;
}

export interface AccessTokenPayload {
  userId?: UUID;
  role?: UserRole;
  sessionId?: UUID;
}


export function generateAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, config.jwt.accessTokenSecret, { expiresIn: config.jwt.accessTokenLifetime });
}

export function generateRefreshToken(payload: RefreshTokenPayload) {
  return jwt.sign(payload, config.jwt.refreshTokenSecret, { expiresIn: config.jwt.refreshTokenLifetime });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.accessTokenSecret) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.refreshTokenSecret) as RefreshTokenPayload;
  } catch {
    return null;
  }
}