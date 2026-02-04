import Controller, { get, body, useTransaction, auth } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureDb, UnauthorizedError } from '../core/httpContext.js';
import { config, Environment } from '../global.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../core/tokens.js';
import { createUser, authUser, getUser } from '../services/user.js';
import { randomUUID } from 'crypto';
import { UserRole } from '../dal/models/user.js';

export default class RootController extends Controller {

  @get("/me")
  @auth(UserRole.USER)
  @useTransaction()
  async me({ res, userId, db }: HttpContext) {
    db = ensureDb(db);
    // TODO: add user = ensureUser(userId);
    
    const user = await db.user.get(userId);
    res.status(200).json({ user });
  }  
}