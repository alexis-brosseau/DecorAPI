CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop tables (reverse dependency order)
DROP TABLE IF EXISTS "user";

-- Drop types
DROP TYPE IF EXISTS user_role;

-- User
CREATE TYPE user_role AS ENUM ('admin', 'user', 'guest');


CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(16) NOT NULL,
    role user_role NOT NULL,
    email VARCHAR(255) UNIQUE,
    hash VARCHAR(255),
    token_version INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);