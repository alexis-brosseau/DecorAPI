import express from "express";
import { config, ansi } from './global.js';
import * as os from "os";
import http from "http";
import Logger from './core/logger.js';
import cookieParser from 'cookie-parser';
import loggerHandler from "./middlewares/logger.js";
import corsHandler from "./middlewares/cors.js";
import controllerRouter from './middlewares/controller.js';
import errorHandler from './middlewares/error.js';
import { authMiddleware } from "./middlewares/auth.js";
import GameManager from "./game/GameManager.js";
import CatanGame from "./game/catan/CatanGame.js";

const app = express();
export const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(loggerHandler);
app.use(corsHandler);
app.use(authMiddleware);

app.use(controllerRouter);

// Error handling middleware should be the last one
app.use(errorHandler);

const gameManager = new GameManager();
gameManager.register('/ws/catan', () => new CatanGame());
gameManager.attach(server);

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
