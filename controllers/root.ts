import { Controller, get, auth, useTransaction } from 'express-decor/controller';
import type HttpContext from 'express-decor/httpContext';
import { ensureToken } from 'express-decor/httpContext';
import { getUser } from '../services/user.js';

export default class RootController extends Controller {

  @get("/me")
  @auth()
  @useTransaction()
  async me({ res, token, db }: HttpContext) {
    token = ensureToken(token);

    const user = await getUser(token.userId, db);
    res.status(200).json({ user });
  }  
}