import Controller, { get, post, body, useTransaction, Optional, UUID as UUIDType } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureDb, ensureIdentity } from '../core/httpContext.js';
import { listLobbies, createLobby, joinLobby } from '../services/game.js';

export default class GameController extends Controller {

  @get('/')
  @useTransaction()
  async listLobbies({ res, db, identity  }: HttpContext) {
    db = ensureDb(db);
    ensureIdentity(identity);
    
    const lobbies = await listLobbies(50, db);
    res.json({ lobbies });
  }

  @post('/')
  @body({ name: Optional(String), maxPlayers: Optional(Number) })
  @useTransaction()
  async createLobby({ res, body, db, identity }: HttpContext) {
    db = ensureDb(db);
    const userId = identity?.isUser() ? (identity.id as any) : null;
    const lobby = await createLobby({ name: body.name ?? null, maxPlayers: body.maxPlayers ?? 4, userId }, db);
    res.status(201).json({ lobby });
  }

  @post('/join')
  @body({
    joinCode: Optional(String),
    gameId: Optional(UUIDType),
  })
  @useTransaction()
  async join({ res, body, db, identity }: HttpContext) {
    db = ensureDb(db);
    identity = ensureIdentity(identity);

    const result = await joinLobby(
      {
        joinCode: body.joinCode,
        gameId: body.gameId,
        identity: identity,
      },
      db
    );

    res.status(200).json({
      game: result.game,
      player: result.player,
      ws: result.ws,
    });
  }
}
