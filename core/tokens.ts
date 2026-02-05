import type { UUID } from 'crypto';

import { config } from '../global.js';
import jwt from 'jsonwebtoken';
import { UserRole } from '../dal/models/user.js';

export interface RefreshTokenPayload {
  userId: UUID;
  version: number;
}

export interface AccessTokenPayload {
  userId: UUID;
  role: string;
}

// Access Token Functions
export function generateAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, config.jwt.accessTokenSecret, { expiresIn: config.jwt.accessTokenLifetime });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.accessTokenSecret);
    return decoded as AccessTokenPayload;
  } catch {
    return null;
  }
}

// Refresh Token Functions
export function generateRefreshToken(payload: RefreshTokenPayload) {
  return jwt.sign(payload, config.jwt.refreshTokenSecret, { expiresIn: config.jwt.refreshTokenLifetime });
}


export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshTokenSecret);
    return decoded as RefreshTokenPayload;
  } catch {
    return null;
  }
}