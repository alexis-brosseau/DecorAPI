import type { UUID } from 'crypto';

import { config } from '../global.js';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../dal/models/user.js';

export interface RefreshTokenPayload {
  userId: UUID;
  version: number;
}

export interface AccessTokenPayload {
  userId?: UUID;
  role?: UserRole;
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
    const verifiedToken = jwt.verify(token, config.jwt.refreshTokenSecret);
    return verifiedToken as RefreshTokenPayload;
  } catch {
    return null;
  }
}