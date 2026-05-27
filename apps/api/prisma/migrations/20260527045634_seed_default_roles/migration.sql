-- Seed the application roles defined in the design document. Registration
-- and role management code can rely on these rows existing without
-- upserting them at runtime.
INSERT INTO "roles" ("id", "code", "name") VALUES
    (1, 'user',      'Авторизованный пользователь'),
    (2, 'moderator', 'Модератор'),
    (3, 'admin',     'Администратор')
ON CONFLICT ("id") DO UPDATE
    SET "code" = EXCLUDED."code",
        "name" = EXCLUDED."name";
