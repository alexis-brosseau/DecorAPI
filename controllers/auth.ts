import Controller, { post, body, useTransaction, auth } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureBody, UnauthorizedError } from '../core/httpContext.js';
import { config, Environment } from '../global.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../core/tokens.js';
import { createUser, authUser, getUser, createGuest } from '../services/user.js';
import { UserRole } from '../dal/models/user.js';

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
  @body({ username: String })
  @useTransaction()
  async guest({ res, body, db }: HttpContext) {
    const { username } = ensureBody(body);
    const guest = await createGuest(username, db);

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
  @auth(UserRole.GUEST)
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
  @auth(UserRole.USER)
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