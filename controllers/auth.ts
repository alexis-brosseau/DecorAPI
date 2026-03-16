import { Controller, post, body, auth, Optional, Varchar, Email  } from 'express-decor/controller';
import type HttpContext from 'express-decor/httpContext';
import { ensureBody, ensureDb } from 'express-decor/httpContext';
import { transaction } from 'express-decor/database';
import { UnauthorizedError } from 'express-decor/errors';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from 'express-decor/jwt';

import { config, Environment } from '../global.js';
import UserRepository from '../repositories/user.js';

export default class AuthController extends Controller {

  @post("/register")
  @body({ username: Varchar(4, 16), email: Email, password: Varchar(8) })
  async register({ res, body }: HttpContext) {
    const { username, email, password } = ensureBody(body);

    const user = await transaction((db) => 
      db.repo(UserRepository).createUser({ username, email, password })
    );

    res.status(201).json({ user });
  }

  @post("/login")
  @body({ email: Email, password: Varchar(8) })
  async login({ res, body }: HttpContext) {
    const { email, password } = ensureBody(body);

    const user = await transaction((db) => 
      db.repo(UserRepository).auth({ email, password })
    );

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
  @body({ username: Optional(Varchar(4, 16)) })
  async guest({ res, body }: HttpContext) {
    const { username } = ensureBody(body);

    const guest = await transaction((db) => 
      db.repo(UserRepository).createGuest({ 
        username: username ?? `Guest-${Math.floor(Math.random() * 100000)}` 
      })
    );

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
  async refresh({ res, req }: HttpContext) {
    
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) throw new UnauthorizedError('Credentials not provided');

    const token = verifyRefreshToken(refreshToken);
    if (!token) throw new UnauthorizedError('Invalid or expired token');

    const user = await transaction((db) => 
      db.repo(UserRepository).get(token.userId)
    );

    if (!user || user.tokenVersion !== token.version) throw new UnauthorizedError('Unauthorized');
    
    const accessToken = generateAccessToken({ 
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