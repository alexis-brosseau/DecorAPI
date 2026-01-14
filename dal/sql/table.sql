-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop tables (reverse dependency order)
DROP TABLE IF EXISTS catan_trade_offer;
DROP TABLE IF EXISTS catan_chat_message;
DROP TABLE IF EXISTS catan_game_event;
DROP TABLE IF EXISTS catan_game_state;
DROP TABLE IF EXISTS catan_game_player;
DROP TABLE IF EXISTS catan_session;
DROP TABLE IF EXISTS catan_game;
DROP TABLE IF EXISTS "user";

-- Drop types
DROP TYPE IF EXISTS catan_trade_status;
DROP TYPE IF EXISTS catan_player_color;
DROP TYPE IF EXISTS catan_game_status;
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

-- =========================
-- Catan multiplayer schema
-- =========================

CREATE TYPE catan_game_status AS ENUM ('lobby', 'running', 'finished', 'abandoned');
CREATE TYPE catan_player_color AS ENUM ('red', 'blue', 'white', 'orange', 'green', 'brown');
CREATE TYPE catan_trade_status AS ENUM ('open', 'accepted', 'declined', 'cancelled', 'expired');

-- Anonymous sessions (optional; game players can be tied to either a registered user OR a session)
CREATE TABLE catan_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- A game lobby/match
CREATE TABLE catan_game (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    join_code VARCHAR(16) NOT NULL UNIQUE,
    name VARCHAR(64),
    status catan_game_status NOT NULL DEFAULT 'lobby',
    max_players SMALLINT NOT NULL DEFAULT 4,
    created_by_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    seed INT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    CHECK (max_players BETWEEN 3 AND 6)
);

-- Players seated in a particular game (registered OR anonymous)
CREATE TABLE catan_game_player (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES catan_game(id) ON DELETE CASCADE,
    user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
    session_id UUID REFERENCES catan_session(id) ON DELETE SET NULL,

    seat SMALLINT NOT NULL,
    color catan_player_color,
    display_name VARCHAR(32) NOT NULL,

    is_host BOOLEAN NOT NULL DEFAULT false,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    is_connected BOOLEAN NOT NULL DEFAULT false,

    victory_points SMALLINT NOT NULL DEFAULT 0,

    -- Lightweight counters commonly needed for UI; detailed state lives in catan_game_state
    played_knights SMALLINT NOT NULL DEFAULT 0,
    longest_road_length SMALLINT NOT NULL DEFAULT 0,
    largest_army BOOLEAN NOT NULL DEFAULT false,
    longest_road BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (seat BETWEEN 1 AND 6),
    CHECK (char_length(display_name) >= 1),
    CHECK ((user_id IS NOT NULL) OR (session_id IS NOT NULL))
);

-- Uniqueness rules within a game
CREATE UNIQUE INDEX catan_game_player_unique_seat ON catan_game_player(game_id, seat);
CREATE UNIQUE INDEX catan_game_player_unique_color ON catan_game_player(game_id, color) WHERE color IS NOT NULL;
CREATE UNIQUE INDEX catan_game_player_unique_user ON catan_game_player(game_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX catan_game_player_unique_session ON catan_game_player(game_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX catan_game_player_game_id_idx ON catan_game_player(game_id);

-- Current authoritative state snapshot (JSONB keeps board + cards flexible)
-- Recommended shape (your server defines it):
-- { "board": {...}, "turn": {...}, "bank": {...}, "players": {...}, "robber": {...}, ... }
CREATE TABLE catan_game_state (
    game_id UUID PRIMARY KEY REFERENCES catan_game(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 0,
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only event log for multiplayer sync/debug/replay
CREATE TABLE catan_game_event (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES catan_game(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    player_id UUID REFERENCES catan_game_player(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (game_id, seq)
);

CREATE INDEX catan_game_event_game_seq_idx ON catan_game_event(game_id, seq);
CREATE INDEX catan_game_event_game_created_idx ON catan_game_event(game_id, created_at);

-- Simple in-game chat
CREATE TABLE catan_chat_message (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES catan_game(id) ON DELETE CASCADE,
    player_id UUID REFERENCES catan_game_player(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (char_length(message) BETWEEN 1 AND 1000)
);

CREATE INDEX catan_chat_message_game_created_idx ON catan_chat_message(game_id, created_at);

-- Trade offers (details stored as JSONB: give/receive, target players, etc.)
CREATE TABLE catan_trade_offer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES catan_game(id) ON DELETE CASCADE,
    offered_by_player_id UUID NOT NULL REFERENCES catan_game_player(id) ON DELETE CASCADE,
    status catan_trade_status NOT NULL DEFAULT 'open',
    offer JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX catan_trade_offer_game_status_idx ON catan_trade_offer(game_id, status);