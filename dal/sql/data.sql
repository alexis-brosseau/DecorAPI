INSERT INTO "user" (id, username, email, role, hash)
VALUES (
    '660e8400-e29b-41d4-a716-446655440000',
    'Jhon Doe',
    'user@email.com',
    'admin',
    crypt('password', gen_salt('bf'))
)
ON CONFLICT DO NOTHING;