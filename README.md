A lightweight, decorator-based Express framework for TypeScript with built-in validation, transactions, and role-based authentication.

## Features

- **Decorators for routing** - Write routes with `@get`, `@post`, etc. instead of `app.get()`
- **Request validation** - Automatically validate body/query params with TypeScript types
- **Auth built-in** - JWT tokens + role-based permissions (Admin, User, Guest)
- **Database transactions** - Wrap any route in a transaction with one decorator
- **Logging** - Console + file logging that actually helps when debugging
- **Just Express underneath** - No magic, just a nicer API on top of Express
- **Proper error handling** - Custom error classes that map to HTTP status codes

## Quick Start

### Installation

```bash
npm install
npm run build
npm start
```

### Project Structure

```
├── controllers/      # HTTP route handlers
├── services/         # Business logic layer
├── dal/              # Data access layer (models, database)
├── core/             # Framework core (decorators, HTTP context)
├── middlewares/      # Express middlewares
└── global.ts         # Configuration and utilities
```

## Middleware Stack

1. Rate limiting
2. Body parsing (JSON and URL-encoded)
3. Cookie parsing
4. Request logging
5. CORS handling
6. Authentication (JWT validation)
7. Controller routing
8. Error handling

## Available Decorators

### HTTP Methods
- `@get(path)` - GET request
- `@post(path)` - POST request
- `@put(path)` - PUT request
- `@patch(path)` - PATCH request
- `@del(path)` - DELETE request
- `@options(path)` - OPTIONS request
- `@head(path)` - HEAD request

### Validation
- `@body(schema)` - Validate request body
- `@query(schema)` - Validate query parameters

### Security
- `@auth(role)` - Require authentication with minimum role

### Database
- `@useTransaction()` - Wrap handler in database transaction

## Validation Types

Built-in types for validation:

- `String` - Non-empty string
- `Number` - Numeric value
- `Boolean` - Boolean value
- `Object` - Plain object
- `UUID` - Valid UUID v4
- `Email` - Valid email address
- `Optional(Type)` - Optional field
- `ArrayOf(Type)` - Array of specific type

## Usage Examples

### Basic Controller

```typescript
import Controller, { get, post, body } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';

export default class MyController extends Controller {
  @get('/path')
  async myRoute({ res, body }: HttpContext) {
    res.status(200).send("Hello world!");
  }
}
```

### Body Validation

```typescript
import { body, Email, UUID, Optional, ArrayOf } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureBody } from '../core/httpContext.js';

@post('/register')
@body({
  username: String,
  email: Email,
  password: String,
  age: Optional(Number),
  tags: ArrayOf(String),
  userId: UUID
})
async register({ res, body }: HttpContext) {
  // body is type-safe and validated
  const { username, email, password, age, tags, userId } = ensureBody(body);
  // ...
}
```

### Query Parameter Validation

```typescript
import { query, Optional } from '../core/controller.js';
import type HttpContext from '../core/httpContext.js';
import { ensureQuery } from '../core/httpContext.js';

@get('/search')
@query({
  term: String,
  limit: Optional(Number),
  offset: Optional(Number)
})
async search({ res, query }: HttpContext) {
  const { term, limit = 10, offset = 0 } = ensureQuery(query);
  // ...
}
```

### Authentication & Authorization

```typescript
import { auth } from '../core/controller.js';
import { UserRole } from '../dal/models/user.js';

@get('/me')
@auth(UserRole.User)
async getCurrentUser({ res, token }: HttpContext) {
  // Only accessible by User role
  // token contains user information
  const { userId, role } = ensureToken(token);
  // ...
}
```

### Transaction Management

```typescript
import { useTransaction } from '../core/controller.js';
import { UserRole } from '../dal/models/user.js';
import { getUsersByRole } from '../services/user.js';

@post('/transfer')
@useTransaction()
async getAdmin({ res, db }: HttpContext) {
  // All database operations run in a single transaction
  // Automatically rolls back on error
  await getUsersByRole(UserRole.Admin, db);
  // ...
}
```

## Service Layer Pattern

```typescript
// services/user.ts
import type Database from '../dal/database.js';
import { executeWithDb } from '../dal/database.js';

export async function createUser(
  username: string,
  email: string,
  password: string,
  db?: Database
): Promise<User> {
  return executeWithDb(async (database) => {
    return await database.user.createUser({
      id: randomUUID(),
      username,
      email,
      password,
    });
  }, db);
}
```

## Error Handling

Built-in error classes with automatic HTTP status mapping:

```typescript
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from '../core/httpContext.js';

throw new BadRequestError('Invalid input');        // 400
throw new UnauthorizedError('Not authenticated');  // 401
throw new ForbiddenError('Access denied');         // 403
throw new NotFoundError('Resource not found');     // 404
throw new ConflictError('Email already used');     // 409
```

## Configuration

Create a `.env` file:

```env
ENVIRONMENT=dev/prod
PORT=8800
SAVE_LOGS=true/false   (Save logs in a file under /logs)
DEBUG_MODE=true/false  (Output error stack in console)

DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASS=password

ACCESS_TOKEN_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_jwt_secret
```
