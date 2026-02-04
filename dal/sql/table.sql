CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop tables (reverse dependency order)
DROP TABLE IF EXISTS catan_chat_message;
DROP TABLE IF EXISTS catan_game_state;
DROP TABLE IF EXISTS catan_game_player;
DROP TABLE IF EXISTS catan_game;
DROP TABLE IF EXISTS "user";

-- Drop types
DROP TYPE IF EXISTS user_role;

-- User
CREATE TYPE user_role AS ENUM ('admin', 'user');


CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(16) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'user',
    hash VARCHAR(255) NOT NULL,
    token_version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);