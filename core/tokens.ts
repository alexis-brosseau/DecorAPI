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
  role: UserRole;
}

// Access Token Functions
export function generateAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, config.jwt.accessTokenSecret, { expiresIn: config.jwt.accessTokenLifetime });
}

function isAccessTokenPayloadValid(value: unknown): value is { userId: UUID; role: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as any;
  return typeof v.userId === 'string' && typeof v.role === 'string';
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.accessTokenSecret);
    if (!isAccessTokenPayloadValid(decoded)) return null;

    const userRole = UserRole.fromString(decoded.role);
    if (!userRole) return null;

    return { userId: decoded.userId, role: userRole };
  } catch {
    return null;
  }
}

// Refresh Token Functions
export function generateRefreshToken(payload: RefreshTokenPayload) {
  return jwt.sign(payload, config.jwt.refreshTokenSecret, { expiresIn: config.jwt.refreshTokenLifetime });
}

function isRefreshTokenPayloadValid(value: unknown): value is RefreshTokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as any;
  return typeof v.userId === 'string' && typeof v.version === 'number';
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshTokenSecret);
    if (!isRefreshTokenPayloadValid(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}