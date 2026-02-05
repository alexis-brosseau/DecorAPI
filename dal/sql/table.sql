CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop tables (reverse dependency order)
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS game_move;
DROP TABLE IF EXISTS game_session_player;
DROP TABLE IF EXISTS game_session;
DROP TABLE IF EXISTS lobby_player;
DROP TABLE IF EXISTS lobby;
DROP TABLE IF EXISTS game;

-- Drop types
DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS lobby_status;
DROP TYPE IF EXISTS player_status;
DROP TYPE IF EXISTS game_session_status;

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

-- Lobby / Game
CREATE TYPE lobby_status AS ENUM ('waiting', 'ready', 'in_game', 'closed');
CREATE TYPE player_status AS ENUM ('connected', 'disconnected', 'abandoned');
CREATE TYPE game_session_status AS ENUM ('starting', 'active', 'finished', 'aborted');

CREATE TABLE game (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    min_players INT NOT NULL DEFAULT 2,
    max_players INT NOT NULL DEFAULT 8,
    ruleset JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lobby (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES game(id) ON DELETE CASCADE,
    status lobby_status NOT NULL DEFAULT 'waiting',
    is_private BOOLEAN NOT NULL DEFAULT false,
    code VARCHAR(12) UNIQUE,
    options JSONB DEFAULT '{}'::jsonb,
    owner_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lobby_player (
    lobby_id UUID NOT NULL REFERENCES lobby(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    ready BOOLEAN NOT NULL DEFAULT false,
    seat INT UNIQUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lobby_id, user_id)
);

CREATE TABLE game_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES game(id) ON DELETE RESTRICT,
    lobby_id UUID REFERENCES lobby(id) ON DELETE SET NULL,
    status game_session_status NOT NULL DEFAULT 'starting',
    state_snapshot JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE game_session_player (
    game_session_id UUID NOT NULL REFERENCES game_session(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    status player_status NOT NULL DEFAULT 'connected',
    seat INT,
    state JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (game_session_id, user_id)
);

CREATE TABLE game_move (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES game_session(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_session_id, seq)
);

-- Minimal indexes
CREATE INDEX idx_lobby_game_status ON lobby (game_id, status);
CREATE INDEX idx_game_session_game_status ON game_session (game_id, status);