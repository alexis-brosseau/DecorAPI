import express from "express";
import type { Request, Response, NextFunction } from 'express';
import { config, Environment } from '../global.js';

function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (config.environment === Environment.Development)
    allowAllAnonymousAccess(req, res);
  else
    allowVizionaryAccess(req, res);

  if (req.method == 'OPTIONS') {
    res.status(200).send();
    return;
  }

  next();
};

function allowVizionaryAccess(req: express.Request, res: Response) {

  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://vizionary.ca',
    'https://app.vizionari.ca',
    'http://vizionary.ca',
    'http://app.vizionari.ca'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
}

function allowAllAnonymousAccess(req: Request, res: Response) {
  const origin = req.headers.origin || '*';
  
  // If credentials are used, you must reflect the origin instead of "*"
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin'); // prevents caching issues
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
}

export default corsMiddleware;