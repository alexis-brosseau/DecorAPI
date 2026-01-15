import Controller, { get, body, useTransaction } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureDb, UnauthorizedError, ensureIdentity } from '../core/httpContext.js';
import { config, Environment } from '../global.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../core/tokens.js';
import { createUser, authUser, getUser } from '../services/user.js';
import { randomUUID } from 'crypto';
import { Identity, IdentityRole } from '../core/identity.js';

export default class RootController extends Controller {

  @get("/me")
  @useTransaction()
  async me({ res, db, identity }: HttpContext) {
    db = ensureDb(db);
    identity = ensureIdentity(identity, IdentityRole.USER);

    const user = await db.user.get(identity.id);
    res.status(200).json({ user });
  }
}