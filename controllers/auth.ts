import { Controller, post, body, auth, useTransaction, Optional  } from 'express-decor/controller';
import type HttpContext from 'express-decor/httpContext';
import { ensureBody } from 'express-decor/httpContext';
import { UnauthorizedError } from 'express-decor/errors';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from 'express-decor/jwt';

import { config, Environment } from '../global.js';
import { createUser, authUser, getUser, createGuest } from '../services/user.js';

export default class AuthController extends Controller {

  @post("/register")
  @body({ username: String, email: String, password: String })
  @useTransaction()
  async register({ res, body, db }: HttpContext) {
    const { username, email, password } = ensureBody(body);

    const user = await createUser(username, email, password, db);
    res.status(201).json({ user });
  }

  @post("/login")
  @body({ email: String, password: String })
  @useTransaction()
  async login({ res, body, db }: HttpContext) {
    const { email, password } = ensureBody(body);

    const user = await authUser(email, password, db);
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const refreshToken = generateRefreshToken({ 
      userId: user.id, 
      version: user.tokenVersion 
    });

    const accessToken = generateAccessToken({ 
      userId: user.id,
      role: user.role.toString(),
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.environment === Environment.Production,
      sameSite: config.environment === Environment.Production ? 'strict' : 'lax',
      maxAge: config.jwt.refreshTokenLifetime * 1000,
    });

    res.json({ accessToken });
  }

  @post("/guest")
  @body({ username: Optional(String) })
  @useTransaction()
  async guest({ res, body, db }: HttpContext) {
    const { username } = ensureBody(body);
    const guest = await createGuest(username ?? "Guest", db);

    const refreshToken = generateRefreshToken({ 
      userId: guest.id, 
      version: guest.tokenVersion 
    });
    
    const accessToken = generateAccessToken({ 
      userId: guest.id,
      role: guest.role.toString(),
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.environment === Environment.Production,
      sameSite: config.environment === Environment.Production ? 'strict' : 'lax',
      maxAge: config.jwt.refreshTokenLifetime * 1000,
    });

    res.status(201).json({ accessToken });
  }

  @post("/refresh")
  @useTransaction()
  async refresh({ res, req, db }: HttpContext) {

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) throw new UnauthorizedError('Credentials not provided');

    const token = verifyRefreshToken(refreshToken);
    if (!token) throw new UnauthorizedError('Invalid or expired token');
    
    let accessToken;

    const user = await getUser(token.userId, db);
    if (!user || user.tokenVersion !== token.version) throw new UnauthorizedError('Unauthorized');
    
    accessToken = generateAccessToken({ 
      userId: user.id,
      role: user.role.toString(),
    });
    res.json({ accessToken });
  }

  @post("/logout")
  @auth()
  async logout({ res }: HttpContext) {

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.environment === Environment.Production,
      sameSite: 'strict',
    });

    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: config.environment === Environment.Production,
      sameSite: 'strict',
    });
    res.status(200).send("Logged out");
  }
}