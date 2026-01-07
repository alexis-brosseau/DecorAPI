import type { NextFunction, Request, Response } from 'express';
import Logger from "../core/logger.js";
import { DatabaseError } from "pg";
import { BadRequestError, UnauthorizedError, ForbiddenError } from '../core/httpContext.js';

const errorHanlder = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Bad JSON
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json("Invalid JSON payload");
  }
  

  if (err instanceof DatabaseError) {
    Logger.databaseError(err.message, err.code);
    res.status(500).send("Internal Server Error");
    return;
  }

  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: err.message });
    return;
  }
  
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
    return;
  }

  // Unexpected errors
  Logger.serverError("An unexpected error occured", err.message);
  if (err.stack) Logger.debug(err.stack);
  res.status(500).send("Internal Server Error");
};


export default errorHanlder;