import { Controller, get, auth, useTransaction } from 'express-decor/controller';
import type HttpContext from 'express-decor/httpContext';
import { ensureToken, ensureDb } from 'express-decor/httpContext';
import UserRepository from '../repositories/user.js';
import { streamPage } from '../lib/stream.js';

export default class RootController extends Controller {

  @get("/me")
  @auth()
  @useTransaction()
  async me({ res, token, db }: HttpContext) {
    token = ensureToken(token);
    db = ensureDb(db);

    const user = await db.repo(UserRepository).get(token.userId);
    res.status(200).json({ user });
  }

  @get('*splat')
  page({ req, res }: HttpContext) {
    streamPage(req, res);
  }
}