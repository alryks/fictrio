-- Constraints that are not represented directly in Prisma schema.
ALTER TABLE "ratings"
    ADD CONSTRAINT "ratings_value_check" CHECK ("value" BETWEEN 0 AND 3);

ALTER TABLE "follows"
    ADD CONSTRAINT "follows_no_self_follow_check" CHECK ("follower_user_id" <> "followed_user_id");

ALTER TABLE "posts"
    ADD CONSTRAINT "posts_review_or_comment_check" CHECK (
        ("parent_post_id" IS NULL AND "rateable_id" IS NOT NULL)
        OR "parent_post_id" IS NOT NULL
    );

ALTER TABLE "moderation_actions"
    ADD CONSTRAINT "moderation_actions_exactly_one_target_check" CHECK (
        (("target_post_id" IS NOT NULL)::integer + ("target_list_id" IS NOT NULL)::integer) = 1
    );

CREATE UNIQUE INDEX "posts_one_review_per_author_rateable_idx"
    ON "posts"("author_user_id", "rateable_id")
    WHERE "parent_post_id" IS NULL;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE INDEX "works_search_gin_idx"
    ON "works"
    USING GIN (
        to_tsvector(
            'russian',
            coalesce("title", '') || ' ' ||
            coalesce("original_title", '') || ' ' ||
            coalesce("description", '')
        )
    );

-- Trigger functions and procedures.
CREATE OR REPLACE FUNCTION "check_content_kind"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_kind "work_kind";
BEGIN
    SELECT "kind"
    INTO v_kind
    FROM "works"
    WHERE "id" = NEW."work_id";

    IF v_kind IS NULL THEN
        RAISE EXCEPTION 'Work % does not exist', NEW."work_id"
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_kind NOT IN ('movie', 'episode', 'book') THEN
        RAISE EXCEPTION 'Work % with kind % cannot be used as content', NEW."work_id", v_kind
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_check_content_kind"
BEFORE INSERT OR UPDATE ON "contents"
FOR EACH ROW
EXECUTE FUNCTION "check_content_kind"();

CREATE OR REPLACE FUNCTION "check_post_constraints"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_exists boolean;
    v_rating_exists boolean;
BEGIN
    IF NEW."parent_post_id" IS NULL THEN
        IF NEW."rateable_id" IS NULL THEN
            RAISE EXCEPTION 'Review must reference a rateable object'
                USING ERRCODE = 'check_violation';
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM "ratings"
            WHERE "user_id" = NEW."author_user_id"
              AND "rateable_id" = NEW."rateable_id"
        )
        INTO v_rating_exists;

        IF NOT v_rating_exists THEN
            RAISE EXCEPTION 'Review requires an existing rating by the same user for the same rateable object'
                USING ERRCODE = 'check_violation';
        END IF;
    ELSE
        SELECT EXISTS (
            SELECT 1
            FROM "posts"
            WHERE "id" = NEW."parent_post_id"
        )
        INTO v_parent_exists;

        IF NOT v_parent_exists THEN
            RAISE EXCEPTION 'Parent post % does not exist', NEW."parent_post_id"
                USING ERRCODE = 'foreign_key_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_check_post_constraints"
BEFORE INSERT OR UPDATE ON "posts"
FOR EACH ROW
EXECUTE FUNCTION "check_post_constraints"();

CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_users_set_updated_at"
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "trg_works_set_updated_at"
BEFORE UPDATE ON "works"
FOR EACH ROW
EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "trg_lists_set_updated_at"
BEFORE UPDATE ON "lists"
FOR EACH ROW
EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "trg_ratings_set_updated_at"
BEFORE UPDATE ON "ratings"
FOR EACH ROW
EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "trg_posts_set_updated_at"
BEFORE UPDATE ON "posts"
FOR EACH ROW
EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "trg_progress_set_updated_at"
BEFORE UPDATE ON "progress"
FOR EACH ROW
EXECUTE FUNCTION "set_updated_at"();

CREATE OR REPLACE PROCEDURE "moderate_post"(
    p_moderator_user_id uuid,
    p_post_id uuid,
    p_action "moderation_action_kind",
    p_reason text DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "posts" WHERE "id" = p_post_id) THEN
        RAISE EXCEPTION 'Post % does not exist', p_post_id
            USING ERRCODE = 'no_data_found';
    END IF;

    UPDATE "posts"
    SET "is_hidden" = (p_action = 'hide')
    WHERE "id" = p_post_id;

    INSERT INTO "moderation_actions" (
        "id",
        "moderator_user_id",
        "action",
        "target_post_id",
        "target_list_id",
        "reason",
        "created_at"
    )
    VALUES (
        gen_random_uuid(),
        p_moderator_user_id,
        p_action,
        p_post_id,
        NULL,
        p_reason,
        CURRENT_TIMESTAMP
    );
END;
$$;

CREATE OR REPLACE PROCEDURE "moderate_list"(
    p_moderator_user_id uuid,
    p_list_id uuid,
    p_action "moderation_action_kind",
    p_reason text DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "lists" WHERE "id" = p_list_id) THEN
        RAISE EXCEPTION 'List % does not exist', p_list_id
            USING ERRCODE = 'no_data_found';
    END IF;

    UPDATE "lists"
    SET "is_hidden" = (p_action = 'hide')
    WHERE "id" = p_list_id;

    INSERT INTO "moderation_actions" (
        "id",
        "moderator_user_id",
        "action",
        "target_post_id",
        "target_list_id",
        "reason",
        "created_at"
    )
    VALUES (
        gen_random_uuid(),
        p_moderator_user_id,
        p_action,
        NULL,
        p_list_id,
        p_reason,
        CURRENT_TIMESTAMP
    );
END;
$$;

CREATE OR REPLACE FUNCTION "get_feed"(p_user_id uuid)
RETURNS TABLE (
    activity_kind text,
    activity_id uuid,
    actor_user_id uuid,
    rateable_id uuid,
    list_id uuid,
    post_id uuid,
    body text,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        CASE
            WHEN p."parent_post_id" IS NULL THEN 'review'
            ELSE 'comment'
        END AS activity_kind,
        p."id" AS activity_id,
        p."author_user_id" AS actor_user_id,
        p."rateable_id",
        NULL::uuid AS list_id,
        p."id" AS post_id,
        p."body",
        p."created_at"
    FROM "posts" p
    JOIN "follows" f ON f."followed_user_id" = p."author_user_id"
    WHERE f."follower_user_id" = p_user_id
      AND p."is_hidden" = false

    UNION ALL

    SELECT
        'list' AS activity_kind,
        l."id" AS activity_id,
        l."owner_user_id" AS actor_user_id,
        l."rateable_id",
        l."id" AS list_id,
        NULL::uuid AS post_id,
        l."description" AS body,
        l."created_at"
    FROM "lists" l
    JOIN "follows" f ON f."followed_user_id" = l."owner_user_id"
    WHERE f."follower_user_id" = p_user_id
      AND l."is_hidden" = false
      AND l."visibility" = 'public'

    ORDER BY "created_at" DESC
    LIMIT 100;
$$;

-- Database roles required by the course project.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_moderator') THEN
        CREATE ROLE app_moderator;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin;
    END IF;
END;
$$;

GRANT app_user TO app_moderator;
GRANT app_moderator TO app_admin;

GRANT USAGE ON SCHEMA public TO app_user, app_moderator, app_admin;

GRANT SELECT ON
    "rateables",
    "works",
    "contents",
    "movies",
    "shows",
    "seasons",
    "episodes",
    "books",
    "ratings",
    "posts",
    "lists",
    "list_items",
    "follows",
    "progress"
TO app_user;

GRANT INSERT, UPDATE, DELETE ON
    "ratings",
    "posts",
    "lists",
    "list_items",
    "follows",
    "progress"
TO app_user;

GRANT EXECUTE ON FUNCTION "get_feed"(uuid) TO app_user;

GRANT UPDATE ("is_hidden") ON "posts" TO app_moderator;
GRANT UPDATE ("is_hidden") ON "lists" TO app_moderator;
GRANT INSERT ON "moderation_actions" TO app_moderator;
GRANT SELECT ON "moderation_actions" TO app_moderator;
GRANT EXECUTE ON PROCEDURE "moderate_post"(uuid, uuid, "moderation_action_kind", text) TO app_moderator;
GRANT EXECUTE ON PROCEDURE "moderate_list"(uuid, uuid, "moderation_action_kind", text) TO app_moderator;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    "users",
    "roles",
    "user_roles",
    "rateables",
    "works",
    "contents",
    "movies",
    "shows",
    "seasons",
    "episodes",
    "books",
    "lists",
    "list_items",
    "ratings",
    "posts",
    "follows",
    "progress",
    "moderation_actions"
TO app_admin;
