import Logger from "../core/logger.js";
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Assign UUID and IP to request
  res.locals.uuid = randomUUID();
  res.locals.ip = req.headers['x-forwarded-for'] || (req.socket.remoteAddress === "::1" ? "localhost" : req.socket.remoteAddress);

  // Log incoming request
  Logger.incoming(req, res);
  
  // Capture original methods to intercept response
  const originalEnd = res.end;
  const originalSend = res.send;
  const originalJson = res.json;
  const startTime = Date.now();

  // Override end to log response when it completes
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;

    if (res.statusCode >= 400) 
      Logger.outgoing(req, res, responseTime, res.statusMessage);
    else 
      Logger.outgoing(req, res, responseTime, res.statusMessage);

    return originalEnd.call(this, chunk, encoding);
  };
  
  // Override send
  res.send = function(body?: any) {
    return originalSend.call(this, body);
  };
  
  // Override json
  res.json = function(body?: any) {
    return originalJson.call(this, body);
  };
  
  next();
};

export default loggerMiddleware;