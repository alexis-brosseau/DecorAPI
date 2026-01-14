import Controller, { post, body, useTransaction } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureDb, UnauthorizedError, ensureIdentity } from '../core/httpContext.js';
import { config, Environment } from '../global.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../core/tokens.js';
import { createUser, authUser, getUser } from '../services/user.js';
import { randomUUID } from 'crypto';
import { Identity, IdentityRole } from '../core/identity.js';

export default class AuthController extends Controller {

  @post("/register")
  @body({ username: String, email: String, password: String })
  @useTransaction()
  async register({ res, body, db }: HttpContext) {
    const { username, email, password } = body;
    db = ensureDb(db);

    const user = await createUser(username, email, password, db);

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

  @post("/guest")
  @useTransaction()
  async guest({ res, db }: HttpContext) {
    db = ensureDb(db);

    // Create a new guest session
    const guestToken = randomUUID();
    const session = await db.catanSession.create({ token: guestToken, expiresAt: null });

    // Generate access token for the guest
    const accessToken = generateAccessToken({ 
      sessionId: session.id,
      role: IdentityRole.GUEST,
    });

    // Set session cookie
    res.cookie('sessionToken', guestToken, {
      httpOnly: true,
      secure: config.environment === Environment.Production,
      sameSite: config.environment === Environment.Production ? 'strict' : 'lax',
    });

    res.status(201).json({
      guestId: session.id,
      accessToken,
    });
  }

  @post("/logout")
  async logout({ res, identity }: HttpContext) {
    ensureIdentity(identity, IdentityRole.USER)
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