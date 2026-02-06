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

export default class UserController extends Controller {
  @get('/users/:id')
  async getUser({ req, res }: HttpContext) {
    const userId = req.params.id;
    const user = await getUser(userId);
    res.json({ user });
  }

  @post('/users')
  @body({ username: String, email: Email, age: Number })
  async createUser({ res, body }: HttpContext) {
    const user = await createUser(body.username, body.email, body.age);
    res.status(201).json({ user });
  }
}
```

### Body Validation

```typescript
import { body, Email, UUID, Optional, ArrayOf } from '../core/controller.js';

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
  const { username, email, password, age, tags, userId } = body;
  // ...
}
```

### Query Parameter Validation

```typescript
import { query, Optional } from '../core/controller.js';

@get('/search')
@query({
  term: String,
  limit: Optional(Number),
  offset: Optional(Number)
})
async search({ res, query }: HttpContext) {
  const { term, limit = 10, offset = 0 } = query;
  // ...
}
```

### Authentication & Authorization

```typescript
import { auth } from '../core/controller.js';
import { UserRole } from '../dal/models/user.js';

@get('/admin/users')
@auth(UserRole.Admin)
async getUsers({ res, token }: HttpContext) {
  // Only accessible by Admin role
  // token contains user information
  res.json({ users: [] });
}
```

### Transaction Management

```typescript
import { useTransaction } from '../core/controller.js';

@post('/transfer')
@useTransaction()
async transfer({ res, body, db }: HttpContext) {
  // All database operations run in a single transaction
  // Automatically rolls back on error
  await debitAccount(body.fromAccount, body.amount, db);
  await creditAccount(body.toAccount, body.amount, db);
  
  res.json({ success: true });
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
  return executeWithDb(db, async (database) => {
    return await database.user.createUser({
      id: randomUUID(),
      username,
      email,
      password,
    });
  });
}
```

## Error Handling

Built-in error classes with automatic HTTP status mapping:

```typescript
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from '../core/httpContext.js';

throw new BadRequestError('Invalid input');        // 400
throw new UnauthorizedError('Not authenticated');  // 401
throw new ForbiddenError('Access denied');         // 403
throw new NotFoundError('Resource not found');     // 404
```

## Configuration

Create a `.env` file:

```env
PORT=3000
DB_HOST=localhost
DB_USER=postgres
DB_PASS=password
DB_NAME=webgame
DB_PORT=5432
JWT_SECRET=your-secret-key
```

## Author

Alexis Brosseau
