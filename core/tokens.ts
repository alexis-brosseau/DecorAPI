import type { UUID } from 'crypto';

import { config } from '../global.js';
import jwt from 'jsonwebtoken';
import type { IdentityRole } from './identity.js';

export interface RefreshTokenPayload {
  userId: UUID;
  version: number;
}

export interface GuestRefreshTokenPayload {
  guestId: UUID;
}

export interface AccessTokenPayload {
  userId?: UUID;
  role?: IdentityRole;
}

export interface GuestAccessTokenPayload {
  guestId: UUID;
}


export function generateAccessToken(payload: AccessTokenPayload | GuestAccessTokenPayload) {
  return jwt.sign(payload, config.jwt.accessTokenSecret, { expiresIn: config.jwt.accessTokenLifetime });
}

export function generateRefreshToken(payload: RefreshTokenPayload | GuestRefreshTokenPayload) {
  return jwt.sign(payload, config.jwt.refreshTokenSecret, { expiresIn: config.jwt.refreshTokenLifetime });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.accessTokenSecret) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | GuestRefreshTokenPayload | null {
  try {
    const verifiedToken = jwt.verify(token, config.jwt.refreshTokenSecret);
    return verifiedToken as RefreshTokenPayload | GuestRefreshTokenPayload;
  } catch {
    return null;
  }
}