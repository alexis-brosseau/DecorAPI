import express from "express";
import { config, ansi } from './global.js';
import * as os from "os";
import http from "http";
import decor from "express-decor";
import Logger from 'express-decor/logger';
import corsMiddleware from "./middlewares/cors.js";
import rateLimit from 'express-rate-limit';

const app = express();
export const server = http.createServer(app);

app.use(rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    status: 429,
    error: 'Too many requests, please try again later.',
  },
})); 

app.use(decor({
  pgPool: {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.pass,
    database: config.db.name,
  },
  jwt: {
    accessTokenSecret: config.jwt.accessTokenSecret,
    accessTokenOptions: { 
      expiresIn: config.jwt.accessTokenLifetime 
    },
    refreshTokenSecret: config.jwt.refreshTokenSecret,
    refreshTokenOptions: { 
      expiresIn: config.jwt.refreshTokenLifetime 
    },
  },
  preParseMiddlewares: [
    corsMiddleware
  ],
}));

// Start the server
server.listen(config.port, () => {
  showServerInfos();
});

function showServerInfos() {
  Logger.raw(ansi.dim + "*************************************");
  Logger.raw(ansi.dim + "* MyExpress API".padEnd(35) + " *");
  Logger.raw(ansi.dim + "* Author: Alexis Brosseau".padEnd(35) + " *");
  Logger.raw(ansi.dim + `* Version: ${config.version}`.padEnd(35) + " *");
  Logger.raw(ansi.dim + "*************************************");
  Logger.raw(ansi.dim + `Running on ${os.hostname()}`);
  Logger.raw(ansi.dim + `Listening port: ${config.port}`);
  Logger.raw(ansi.dim + `Time zone: UTC${config.serverTimezoneOffset > 0 ? "-" : "+"}${config.serverTimezoneOffset / 60}`);
  Logger.raw(ansi.dim + `Time: ${new Date().toLocaleDateString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n`);
}
