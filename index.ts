import express from "express";
import { config, ansi } from './global.js';
import * as os from "os";
import http from "http";
import Logger from './core/logger.js';
import cookieParser from 'cookie-parser';
import loggerMiddleware from "./middlewares/logger.js";
import corsMiddleware from "./middlewares/cors.js";
import controllerMiddleware from './middlewares/controller.js';
import errorMiddleware from './middlewares/error.js';
import authMiddleware from "./middlewares/auth.js";
import rateLimit from 'express-rate-limit';

import type { AccessTokenPayload } from "./core/tokens.js";

declare global {
  namespace Express {
    interface Request {
      token?: AccessTokenPayload;
    }
  }
}

const app = express();
export const server = http.createServer(app);

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 5 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    status: 429,
    error: 'Too many requests, please try again later.',
  },
});

// Middlewares Stack - Order matters!
app.use(rateLimiter);

app.use(loggerMiddleware);
app.use(corsMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(authMiddleware);
app.use(controllerMiddleware);

app.use(errorMiddleware); // Error handling middleware should be the last one

// Start the server
server.listen(config.port, () => {
  showServerInfos();
});

function showServerInfos() {
  Logger.custom(ansi.dim + "*************************************");
  Logger.custom(ansi.dim + "* MyExpress API".padEnd(35) + " *");
  Logger.custom(ansi.dim + "* Author: Alexis Brosseau".padEnd(35) + " *");
  Logger.custom(ansi.dim + `* Version: ${config.version}`.padEnd(35) + " *");
  Logger.custom(ansi.dim + "*************************************");
  Logger.custom(ansi.dim + `Running on ${os.hostname()}`);
  Logger.custom(ansi.dim + `Listening port: ${config.port}`);
  Logger.custom(ansi.dim + `Time zone: UTC${config.serverTimezoneOffset > 0 ? "-" : "+"}${config.serverTimezoneOffset / 60}`);
  Logger.custom(ansi.dim + `Time: ${new Date().toLocaleDateString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n`);
}
