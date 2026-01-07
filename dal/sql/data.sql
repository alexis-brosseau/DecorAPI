INSERT INTO "user" (id, name, surname, email, role, hash)
VALUES (
    '660e8400-e29b-41d4-a716-446655440000',
    'Jhon',
    'Doe',
    'user@email.com',
    'admin',
    '$2a$06$vo6aoiXkQW2pEV41O7B5h.wklsSe5ctQGyzuzS87qNqp21gfHkOR.'
)
ON CONFLICT DO NOTHING;

-- Seed anonymous user (used for the seed lobby player)
INSERT INTO "user" (id, name, surname, email, role, hash)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Guest',
    'Seed',
    'anon+seed@example.invalid',
    'user',
    crypt('seed', gen_salt('bf'))
)
ON CONFLICT DO NOTHING;

INSERT INTO catan_game (id, join_code, name, status, max_players, config)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'SEED01',
    'Seed Lobby',
    'lobby',
    4,
    '{}'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO catan_game_player (id, game_id, user_id, seat, color, display_name, is_host, is_ready)
VALUES
(
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    1,
    'red',
    'Guest 1',
    true,
    true
)
ON CONFLICT DO NOTHING;

INSERT INTO catan_game_state (game_id, version, state)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    0,
    '{"phase":"lobby"}'::jsonb
)
ON CONFLICT DO NOTHING;