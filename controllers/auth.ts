import Controller, { post, body, useTransaction } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureDb, UnauthorizedError } from '../core/httpContext.js';
import { config, Environment } from '../global.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../core/tokens.js';
import { createUser, authUser, getUser } from '../services/user.js';
import { randomUUID } from 'crypto';

export default class AuthController extends Controller {

  @post("/anonymous")
  @useTransaction()
  async anonymous({ res, req, db }: HttpContext) {
    db = ensureDb(db);

    // Guests do not get a catan_session here anymore.
    // A session is created only when joining a lobby via POST /game/join.

    if (req.cookies?.refreshToken) {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config.environment === Environment.Production,
        sameSite: 'strict',
      });
    }

    if (req.cookies?.sessionToken) {
      res.clearCookie('sessionToken', {
        httpOnly: true,
        secure: config.environment === Environment.Production,
        sameSite: 'strict',
      });
    }

    const accessToken = generateAccessToken({});
    res.json({ accessToken });
  }

  @post("/register")
  @body({ name: String, surname: String, email: String, password: String })
  @useTransaction()
  async register({ res, body, db }: HttpContext) {
    const { name, surname, email, password } = body;
    db = ensureDb(db);

    const user = await createUser(name, surname, email, password, db);

    // Change to sends email with verification link in production
    res.status(201).json({ user });
  }

  @post("/login")
  @body({ email: String, password: String })
  @useTransaction()
  async login({ res, body, db }: HttpContext) {
    const { email, password } = body;
    db = ensureDb(db);

    const user = await authUser(email, password, db);
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const refreshToken = generateRefreshToken({ 
      userId: user.id, 
      version: user.tokenVersion 
    });

    const accessToken = generateAccessToken({ 
      userId: user.id,
      role: user.role,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.environment === Environment.Production,
      sameSite: config.environment === Environment.Production ? 'strict' : 'lax',
      maxAge: config.jwt.refreshTokenLifetime * 1000,
    });

    res.json({ accessToken });
  }

  @post("/refresh")
  @useTransaction()
  async refresh({ res, req, db }: HttpContext) {
    db = ensureDb(db);

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) throw new UnauthorizedError('Credentials not provided');

    const token = verifyRefreshToken(refreshToken);
    if (!token) throw new UnauthorizedError('Invalid or expired token');

    const user = await getUser(token.userId, db);
    if (!user || user.tokenVersion !== token.version) throw new UnauthorizedError('Unauthorized');

    const accessToken = generateAccessToken({ 
      userId: user.id,
      role: user.role,
    });
    
    res.json({ accessToken });
  }

  @post("/logout")
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