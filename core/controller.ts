import express from 'express';
import type { Router, Request, Response, NextFunction } from 'express';
import type HttpContext from './httpContext.js';
import { transaction } from '../dal/database.js';
import { UnauthorizedError, ForbiddenError, BadRequestError } from './httpContext.js';
import { UserRole } from '../dal/models/user.js';
import { verifyAccessToken } from './tokens.js';

export interface RouteDefinition {
  method: keyof Router;
  path: string;
  handler: string;
}

export default class Controller {
  public router: Router;
  static routes?: RouteDefinition[];

  constructor() {
    this.router = express.Router();
    this.router.all('*splat', (req: Request, res: Response, next: NextFunction) => {
      next();
    });

    // Register routes from decorators
    const routes: RouteDefinition[] = (this.constructor as typeof Controller).routes || [];
    for (const { method, path, handler } of routes) {
      (this.router[method] as any).call(this.router, path, (this as any)[handler].bind(this));
    }
  }
}


////////////////////////////////
// Decorators for HTTP methods
///////////////////////////////

// Factory to create method decorators
function createRouteDecorator(method: keyof Router) {
  return function (path: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      if (!target.constructor.routes) target.constructor.routes = [];

      const original = descriptor.value;

      descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
        const ctx: HttpContext = {
          req,
          res,
          token: req.token,
        };

        try {
          await original.call(this, ctx);
        } catch (err) {
          next(err);
        }
      };

      target.constructor.routes.push({ method, path, handler: propertyKey });
    };
  };
}

export const get = createRouteDecorator('get');
export const post = createRouteDecorator('post');
export const put = createRouteDecorator('put');
export const del = createRouteDecorator('delete'); // 'delete' is a reserved word
export const patch = createRouteDecorator('patch');
export const options = createRouteDecorator('options');
export const head = createRouteDecorator('head');


////////////////////////////////////////
// Decorator for protected routes
////////////////////////////////////////

// Previously this file provided an `auth()` decorator that rejected unauthenticated
// requests. Authentication is now performed by a middleware which sets `req.userId`
// and `req.token` to either a value or `null`. Use `ensureUser(ctx)` from
// `core/httpContext.ts` inside handlers that require authentication.

///////////////////////////////////////
// Body validation decorator
///////////////////////////////////////

// Custom types
export class UUID { name = 'UUID' };

// Supported types
type Constructor =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor
  | typeof UUID;

// Optional type wrapper
class ArrayOfConstructor {
  constructor(public type: Constructor) {
    this.type = type;
  }
}

type Schema = Constructor | ArrayOfConstructor;

class OptionalConstructor {
  constructor(public type: Schema) {
    this.type = type;
  }
}

export function Optional(type: Schema) {
  return new OptionalConstructor(type);
}

export function ArrayOf(type: Constructor) {
  return new ArrayOfConstructor(type);
}

// Validate a value against a type
const typeValidators: Record<Constructor['name'], (value: any) => boolean> = {
  String: (v) => typeof v === 'string' && v.length > 0,
  Number: (v) => typeof v === 'number',
  Boolean: (v) => typeof v === 'boolean',
  Object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
  UUID: (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v),
};

type FieldDefinition = Schema | OptionalConstructor;

function hasValidator(schema: Schema): boolean {
  if (schema instanceof ArrayOfConstructor) {
    return hasValidator(schema.type);
  }
  return Boolean(typeValidators[schema.name]);
}

function isValidSchema(value: any, schema: Schema): boolean {
  if (schema instanceof ArrayOfConstructor) {
    if (!Array.isArray(value)) return false;
    return value.every(item => isValidSchema(item, schema.type));
  }
  const validator = typeValidators[schema.name];
  return validator ? validator(value) : false;
}

function schemaLabel(schema: Schema): string {
  if (schema instanceof ArrayOfConstructor) {
    return `Array<${schema.type.name}>`;
  }
  return schema.name;
}

// Decorator to ensure that the request body contains specific fields
export const body = (fields: { [key: string]: FieldDefinition }) => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function (ctx: HttpContext, ...args: any[]) {
    const { req } = ctx;
    const validatedBody: Record<string, any> = {};

    for (const [field, type] of Object.entries(fields)) {
      const value = req.body?.[field];

      if (value === undefined) {
        if (type instanceof OptionalConstructor) continue;
        throw new BadRequestError(`Missing required field: ${field}`);
      }

      const schema = type instanceof OptionalConstructor ? type.type : type;
      if (!hasValidator(schema)) {
        throw new BadRequestError(`Unknown type for field ${field}`);
      }

      if (!isValidSchema(value, schema)) {
        throw new BadRequestError(`Field ${field} must be of type ${schemaLabel(schema)}`);
      }

      validatedBody[field] = value;
    }

    return await originalMethod.call(this, { ...ctx, body: validatedBody }, ...args);
  }
}

// Decorator to ensure that the query parameters contain specific fields
export const query = (fields: { [key: string]: FieldDefinition }) => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function (ctx: HttpContext, ...args: any[]) {
    const { req } = ctx;
    const validatedQuery: Record<string, any> = {};

    for (const [field, type] of Object.entries(fields)) {
      const value = req.query?.[field];

      if (value === undefined) {
        if (type instanceof OptionalConstructor) continue;
        throw new BadRequestError(`Missing required query parameter: ${field}`);
      }

      const schema = type instanceof OptionalConstructor ? type.type : type;
      if (!hasValidator(schema)) {
        throw new BadRequestError(`Unknown type for query parameter ${field}`);
      }

      if (!isValidSchema(value, schema)) {
        throw new BadRequestError(`Query parameter ${field} must be of type ${schemaLabel(schema)}`);
      }

      validatedQuery[field] = value;
    }

    return await originalMethod.call(this, { ...ctx, query: validatedQuery }, ...args);
  }
}

///////////////////////////////////////
// Decorator for protected routes
////////////////////////////////////////

// Take a UserRole and checks if the user has sufficient role to access the route
// Add a 'user' property to the HttpContext
export function auth(role: UserRole) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (ctx: HttpContext, ...args: any[]) {
      const { req } = ctx;

      const authHeader = req.headers.authorization;
      if (!authHeader) throw new UnauthorizedError("Unauthorized");

      const [type, accessToken] = authHeader.split(' ');
      if (type !== 'Bearer') throw new BadRequestError("Invalid token type");
      if (!accessToken) throw new BadRequestError("Invalid token");

      const token = verifyAccessToken(accessToken);
      if (!token) throw new UnauthorizedError("Invalid or expired token");

      if (!token.role || token.role < role) throw new ForbiddenError("Forbidden");

      return await originalMethod.call(this, { ...ctx, token }, ...args);
    }
  }
}


////////////////////////////////
// Decorator for transactional functions
////////////////////////////////

// Add a 'db' property to the HttpContext
// Each call to the decorated method will run in a transaction
export const useTransaction = () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function (ctx: HttpContext, ...args: any[]) {
    return await transaction(async (db) => {
      return await originalMethod.call(this, { ...ctx, db }, ...args);
    });
  };
}