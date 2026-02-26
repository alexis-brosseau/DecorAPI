import dotenv from "dotenv";

export enum Environment {
  Development = "development",
  Production = "production",
}

function parseEnvironment(raw: unknown): Environment {
  const value = String(raw ?? '').toLowerCase();
  if (value === Environment.Production || value === 'prod') return Environment.Production;
  if (value === Environment.Development || value === 'dev') return Environment.Development;
  return Environment.Development;
}

dotenv.config();

export const config = {
  environment: parseEnvironment(process.env.ENVIRONMENT),
  version: "1.0.0",
  port: Number(process.env.PORT),
  db: {
    host: String(process.env.DB_HOST),
    user: String(process.env.DB_USER),
    pass: String(process.env.DB_PASS),
    name: String(process.env.DB_NAME),
    port: Number(process.env.DB_PORT),
  },
  jwt:{
    accessTokenSecret: String(process.env.ACCESS_TOKEN_SECRET),
    refreshTokenSecret: String(process.env.REFRESH_TOKEN_SECRET),
    accessTokenLifetime: 10 * 60, // 10 minutes
    refreshTokenLifetime: 30 * 24 * 60 * 60, // 30 days
  },
  serverTimezoneOffset: new Date().getTimezoneOffset(),
};

export const dbErr = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  notNullViolation: "23502",
  checkViolation: "23514",
}

export const ansi = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
  },
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
  }
}

