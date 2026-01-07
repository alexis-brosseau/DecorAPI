import Controller, { get, post, body, useTransaction, Optional, UUID as UUIDType } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureDb } from '../core/httpContext.js';
import { listLobbies, createLobby, joinLobby } from '../services/game.js';
import { generateAccessToken } from '../core/tokens.js';
import { config, Environment } from '../global.js';
import { randomUUID } from 'crypto';

export default class GameController extends Controller {

  @get('/lobbies')
  @useTransaction()
  async listLobbies({ res, db }: HttpContext) {
    db = ensureDb(db);
    const lobbies = await listLobbies(50, db);
    res.json({ lobbies });
  }

  @post('/lobbies')
  @body({ name: Optional(String), maxPlayers: Optional(Number) })
  @useTransaction()
  async createLobby({ res, body, db, userId }: HttpContext) {
    db = ensureDb(db);
    const lobby = await createLobby({ name: body.name ?? null, maxPlayers: body.maxPlayers ?? 4, userId: (userId as any) ?? null }, db);
    res.status(201).json({ lobby });
  }

  @post('/join')
  @body({
    joinCode: Optional(String),
    gameId: Optional(UUIDType),
    displayName: Optional(String),
  })
  @useTransaction()
  async join({ res, body, db, userId, sessionId, token, req }: HttpContext) {
    db = ensureDb(db);

    // Only issue catan_session for guests when they actually join a lobby.
    let effectiveUserId = userId ?? null;
    let effectiveSessionId = sessionId ?? null;

    if (!effectiveUserId) {
      const existingSessionToken = req.cookies?.sessionToken;
      if (existingSessionToken) {
        const session = await db.catanSession.getByToken(existingSessionToken);
        if (session && (!session.expiresAt || session.expiresAt.getTime() > Date.now())) {
          await db.catanSession.touch(session.id as any);
          effectiveSessionId = session.id as any;
        } else {
          res.clearCookie('sessionToken', {
            httpOnly: true,
            secure: config.environment === Environment.Production,
            sameSite: 'strict',
          });
        }
      }

      if (!effectiveSessionId) {
        const newSessionToken = randomUUID();
        const session = await db.catanSession.create({ token: newSessionToken, expiresAt: null });
        effectiveSessionId = session.id as any;
        res.cookie('sessionToken', newSessionToken, {
          httpOnly: true,
          secure: config.environment === Environment.Production,
          sameSite: config.environment === Environment.Production ? 'strict' : 'lax',
        });
      }
    }

    if (!effectiveUserId && !effectiveSessionId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await joinLobby(
      {
        joinCode: body.joinCode,
        gameId: body.gameId,
        displayName: body.displayName,
        userId: effectiveUserId as any,
        sessionId: effectiveSessionId as any,
      },
      db
    );

    // Unify: join always returns a fresh accessToken usable for WS.
    const accessToken = effectiveUserId
      ? generateAccessToken({
          userId: effectiveUserId as any,
          ...(token?.role ? { role: token.role } : {}),
        })
      : generateAccessToken({ sessionId: effectiveSessionId as any });

    res.json({
      ...result,
      accessToken,
      ws: {
        ...result.ws,
        query: {
          ...(result.ws.query as any),
          accessToken,
        },
      },
    });
  }
}
