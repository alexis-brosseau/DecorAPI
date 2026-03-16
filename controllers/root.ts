import { Controller, get, auth, useTransaction } from 'express-decor/controller';
import { transaction } from 'express-decor/database';
import type HttpContext from 'express-decor/httpContext';
import { ensureToken, ensureDb } from 'express-decor/httpContext';
import UserRepository from '../repositories/user.js';

export default class RootController extends Controller {

  @get("/me")
  @auth()
  async me({ res, token }: HttpContext) {
    token = ensureToken(token);

    const user = await transaction((db) => 
      db.repo(UserRepository).get(token.userId)
    );

    res.status(200).json({ user });
  }
}