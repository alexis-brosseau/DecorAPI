import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../core/tokens.js';
import type { UUID } from 'crypto';
import { UserRole } from '../dal/models/user.js';

declare global {
  namespace Express {
    interface Request {
      userId?: UUID | null;
      role?: UserRole | null;
      token?: import('../core/tokens.js').AccessTokenPayload | null;
    }
  }
}

/**
 * Auth middleware that extracts user info from Bearer token.
 * Sets `req.userId` and `req.token` to null if not authenticated (allows anonymous access).
 * Use `ensureUser(ctx)` in handlers to require authentication.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const [type, accessToken] = authHeader.split(' ');
  if (type !== 'Bearer' || !accessToken) return next();

  try {
    const token = verifyAccessToken(accessToken);
    if (!token) return next();
    req.userId = token.userId ?? null;
    req.role = token.role ?? null;
    req.token = token;
    return next();
  } catch (e) {
    // On any verification error, treat as anonymous
    return next();
  }
}
