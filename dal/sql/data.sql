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