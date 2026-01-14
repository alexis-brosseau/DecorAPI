import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../core/tokens.js';
import { Identity } from '../core/identity.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string | null;
      sessionId?: string | null;
      token?: import('../core/tokens.js').AccessTokenPayload | null;
      identity?: import('../core/identity.js').Identity | null;
    }
  }
}

/**
 * Auth middleware that extracts user info from Bearer token.
 * Sets `req.userId` and `req.token` to null if not authenticated (allows anonymous access).
 * Use `ensureUser(ctx)` in handlers to require authentication.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  (req as any).userId = null;
  (req as any).sessionId = null;
  (req as any).token = null;
  (req as any).identity = null;

  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const [type, accessToken] = authHeader.split(' ');
  if (type !== 'Bearer' || !accessToken) return next();

  try {
    const token = verifyAccessToken(accessToken);
    if (!token) return next();
    (req as any).userId = (token as any).userId ?? null;
    (req as any).role = (token as any).role ?? null;
    (req as any).sessionId = (token as any).sessionId ?? null;
    (req as any).token = token;
    (req as any).identity = Identity.fromAuth(
      (token as any).userId,
      (token as any).sessionId,
      (token as any).role
    );
    return next();
  } catch (e) {
    // On any verification error, treat as anonymous
    return next();
  }
}
