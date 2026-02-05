import Controller, { get, useTransaction, auth } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureToken } from '../core/httpContext.js';
import { getUser } from '../services/user.js';
import { UserRole } from '../dal/models/user.js';

export default class RootController extends Controller {

  @get("/me")
  @auth(UserRole.GUEST)
  @useTransaction()
  async me({ res, token, db }: HttpContext) {
    const { userId } = ensureToken(token);

    const user = await getUser(userId, db);
    res.status(200).json({ user });
  }  
}