import { config, ansi } from '../global.js';
import type { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';

class Logger {
  logDir: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.initLogDir();
  }

  async initLogDir() {
    if (!config.saveLogs) return; // Skip the creation

    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  getLogFilePath() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `server-${date}.json`);
  }

  async writeToFile(message: string, logType: string, data: Record<string, unknown>) {
    if (!config.saveLogs) return; // Skip the writing

    try {
      // Create structured JSON log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: logType,
        message: message,
        ...data
      };

      await fs.appendFile(
        this.getLogFilePath(),
        JSON.stringify(logEntry) + '\n'
      );
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  incoming(req: Request, res: Response) {
    const uuid = res.locals.uuid || 'UNKNOWN';
    let fontColor;
    switch (req.method) {
      case "GET":
        fontColor = ansi.fg.blue;
        break;
      case "POST":
        fontColor = ansi.fg.green;
        break;
      case "PUT":
        fontColor = ansi.fg.yellow;
        break;
      case "DELETE":
        fontColor = ansi.fg.red;
        break;
      default:
        fontColor = ansi.fg.white;
    }

    const message = `${ansi.fg.white}[${res.locals.uuid}] ⇒${ansi.reset} ${fontColor}${req.method}${ansi.reset} ${req.originalUrl} ${ansi.dim}from ${res.locals.ip}${ansi.reset}`;
    console.log(`${ansi.dim}${this.getTimestamp()} ${message}`);

    // JSON log data
    const logData = {
      uuid,
      ip: res.locals.ip,
      direction: "incoming",
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body || {},
    };

    this.writeToFile(`${req.method} ${req.originalUrl}`, "request", logData);
    return uuid;
  }

  outgoing(req: Request, res: Response, responseTime: number, body: unknown = null) {
    const uuid = res.locals.uuid || 'UNKNOWN';
    const statusCode = typeof res.statusCode === 'number' ? res.statusCode : parseInt(res.statusCode as any);
    
    let statusColor = ansi.fg.green;
    if (statusCode >= 400) statusColor = ansi.fg.red;
    else if (statusCode >= 300) statusColor = ansi.fg.yellow;
    
    const message = `${ansi.fg.white}[${uuid}] ⇐${ansi.reset} ${statusColor}${statusCode}${ansi.reset} ${ansi.dim}(${responseTime}ms)${ansi.reset}${body ? ` ${body}` : ''}`;
    console.log(`${ansi.dim}${this.getTimestamp()} ${ansi.reset}${message}`);
    
    // JSON log data
    const logData = {
      uuid,
      ip: res.locals.ip,
      direction: "outgoing",
      status: statusCode,
      responseTime: responseTime,
      body
    };
    this.writeToFile(`${statusCode}${body ? ` ${body}` : ''}`, "response", logData);
  }

  serverMessage(message: string) {
    const formattedMessage = `${ansi.fg.cyan}ⓘ INFO ${ansi.reset} ${message}`;
    console.log(`${this.getTimestamp()} ${formattedMessage}`);
    this.writeToFile(message, "info", {});
  }

  serverWarning(message: string) {
    const formattedMessage = `${ansi.fg.yellow}⚠ WARN ${ansi.reset} ${message}`;
    console.log(`${this.getTimestamp()} ${formattedMessage}`);
    this.writeToFile(message, "warning", {});
  }

  serverError(message: string, error: unknown = null) {
    let formattedMessage = `${ansi.bg.red}${ansi.fg.white} ERROR ${ansi.reset} ${message}`;
    if (error) formattedMessage += ` - ${error}`;
    
    console.log(`${this.getTimestamp()} ${formattedMessage}`);
    this.writeToFile(message, "error", { stack: new Error().stack });
  }

  databaseError(message: string, code?: string) {
    const formattedMessage = `${ansi.bg.red}${ansi.fg.white} DB ERROR ${ansi.reset} [${code}] ${message}`;
    console.log(`${this.getTimestamp()} ${formattedMessage}`);
    this.writeToFile(message, "database_error", { code });
  }

  debug(message: string) {
    if (config.debugMode) {
      const formattedMessage = `${ansi.fg.magenta}🔍 DEBUG${ansi.reset} ${message}`;
      console.log(`${this.getTimestamp()} ${formattedMessage}`);
      this.writeToFile(message, "debug", {});
    }
  }

  custom(message: string) {
    // Print to console with colors
    console.log(`${message}${ansi.reset}`);

    // Asynchronously write to file without blocking
    this.writeToFile(message, "custom", {});
  }

  getTimestamp() {
    const now = new Date();
    return `${ansi.fg.white}${now.toISOString()}${ansi.reset}`;
  }
}

export default new Logger(); // Export singleton instance