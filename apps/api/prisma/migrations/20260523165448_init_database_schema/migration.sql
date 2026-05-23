-- CreateEnum
CREATE TYPE "rateable_kind" AS ENUM ('work', 'list');

-- CreateEnum
CREATE TYPE "work_kind" AS ENUM ('movie', 'show', 'season', 'episode', 'book');

-- CreateEnum
CREATE TYPE "content_kind" AS ENUM ('movie', 'episode', 'book');

-- CreateEnum
CREATE TYPE "list_visibility" AS ENUM ('public', 'friends', 'private');

-- CreateEnum
CREATE TYPE "progress_status" AS ENUM ('started', 'completed');

-- CreateEnum
CREATE TYPE "moderation_action_kind" AS ENUM ('hide', 'restore');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(64) NOT NULL,
    "bio" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SMALLINT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(64) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" SMALLINT NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "rateables" (
    "id" UUID NOT NULL,
    "kind" "rateable_kind" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rateables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "works" (
    "id" UUID NOT NULL,
    "rateable_id" UUID NOT NULL,
    "kind" "work_kind" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "original_title" VARCHAR(255),
    "description" TEXT,
    "release_year" SMALLINT,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "work_id" UUID NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("work_id")
);

-- CreateTable
CREATE TABLE "movies" (
    "work_id" UUID NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "runtime_minutes" SMALLINT,
    "director_names" TEXT,
    "actor_names" TEXT,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("work_id")
);

-- CreateTable
CREATE TABLE "shows" (
    "work_id" UUID NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "first_air_date" DATE,
    "last_air_date" DATE,
    "creator_names" TEXT,
    "actor_names" TEXT,

    CONSTRAINT "shows_pkey" PRIMARY KEY ("work_id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "work_id" UUID NOT NULL,
    "show_work_id" UUID NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "season_number" SMALLINT NOT NULL,
    "air_date" DATE,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("work_id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "work_id" UUID NOT NULL,
    "season_work_id" UUID NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "episode_number" SMALLINT NOT NULL,
    "air_date" DATE,
    "runtime_minutes" SMALLINT,
    "director_names" TEXT,
    "actor_names" TEXT,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("work_id")
);

-- CreateTable
CREATE TABLE "books" (
    "work_id" UUID NOT NULL,
    "openlibrary_work_key" VARCHAR(32) NOT NULL,
    "first_publish_year" SMALLINT,
    "author_names" TEXT,

    CONSTRAINT "books_pkey" PRIMARY KEY ("work_id")
);

-- CreateTable
CREATE TABLE "lists" (
    "id" UUID NOT NULL,
    "rateable_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "visibility" "list_visibility" NOT NULL DEFAULT 'public',
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_items" (
    "list_id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_items_pkey" PRIMARY KEY ("list_id","work_id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rateable_id" UUID NOT NULL,
    "value" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "rateable_id" UUID,
    "parent_post_id" UUID,
    "body" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_user_id" UUID NOT NULL,
    "followed_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_user_id","followed_user_id")
);

-- CreateTable
CREATE TABLE "progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_work_id" UUID NOT NULL,
    "status" "progress_status" NOT NULL,
    "value_now" INTEGER NOT NULL DEFAULT 0,
    "value_max" INTEGER NOT NULL DEFAULT -1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL,
    "moderator_user_id" UUID NOT NULL,
    "action" "moderation_action_kind" NOT NULL,
    "target_post_id" UUID,
    "target_list_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "works_rateable_id_key" ON "works"("rateable_id");

-- CreateIndex
CREATE INDEX "works_kind_release_year_idx" ON "works"("kind", "release_year");

-- CreateIndex
CREATE INDEX "works_title_idx" ON "works"("title");

-- CreateIndex
CREATE UNIQUE INDEX "movies_tmdb_id_key" ON "movies"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "shows_tmdb_id_key" ON "shows"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_tmdb_id_key" ON "seasons"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_show_work_id_season_number_key" ON "seasons"("show_work_id", "season_number");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_tmdb_id_key" ON "episodes"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_season_work_id_episode_number_key" ON "episodes"("season_work_id", "episode_number");

-- CreateIndex
CREATE UNIQUE INDEX "books_openlibrary_work_key_key" ON "books"("openlibrary_work_key");

-- CreateIndex
CREATE UNIQUE INDEX "lists_rateable_id_key" ON "lists"("rateable_id");

-- CreateIndex
CREATE INDEX "lists_owner_user_id_idx" ON "lists"("owner_user_id");

-- CreateIndex
CREATE INDEX "lists_visibility_idx" ON "lists"("visibility");

-- CreateIndex
CREATE INDEX "list_items_work_id_idx" ON "list_items"("work_id");

-- CreateIndex
CREATE UNIQUE INDEX "list_items_list_id_position_key" ON "list_items"("list_id", "position");

-- CreateIndex
CREATE INDEX "ratings_rateable_id_idx" ON "ratings"("rateable_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_user_id_rateable_id_key" ON "ratings"("user_id", "rateable_id");

-- CreateIndex
CREATE INDEX "posts_author_user_id_idx" ON "posts"("author_user_id");

-- CreateIndex
CREATE INDEX "posts_rateable_id_idx" ON "posts"("rateable_id");

-- CreateIndex
CREATE INDEX "posts_author_user_id_rateable_id_idx" ON "posts"("author_user_id", "rateable_id");

-- CreateIndex
CREATE INDEX "posts_parent_post_id_idx" ON "posts"("parent_post_id");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at");

-- CreateIndex
CREATE INDEX "follows_followed_user_id_idx" ON "follows"("followed_user_id");

-- CreateIndex
CREATE INDEX "progress_content_work_id_idx" ON "progress"("content_work_id");

-- CreateIndex
CREATE UNIQUE INDEX "progress_user_id_content_work_id_key" ON "progress"("user_id", "content_work_id");

-- CreateIndex
CREATE INDEX "moderation_actions_moderator_user_id_idx" ON "moderation_actions"("moderator_user_id");

-- CreateIndex
CREATE INDEX "moderation_actions_target_post_id_idx" ON "moderation_actions"("target_post_id");

-- CreateIndex
CREATE INDEX "moderation_actions_target_list_id_idx" ON "moderation_actions"("target_list_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "works" ADD CONSTRAINT "works_rateable_id_fkey" FOREIGN KEY ("rateable_id") REFERENCES "rateables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movies" ADD CONSTRAINT "movies_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shows" ADD CONSTRAINT "shows_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_show_work_id_fkey" FOREIGN KEY ("show_work_id") REFERENCES "shows"("work_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_work_id_fkey" FOREIGN KEY ("season_work_id") REFERENCES "seasons"("work_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_rateable_id_fkey" FOREIGN KEY ("rateable_id") REFERENCES "rateables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rateable_id_fkey" FOREIGN KEY ("rateable_id") REFERENCES "rateables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_rateable_id_fkey" FOREIGN KEY ("rateable_id") REFERENCES "rateables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_user_id_fkey" FOREIGN KEY ("followed_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_content_work_id_fkey" FOREIGN KEY ("content_work_id") REFERENCES "contents"("work_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_user_id_fkey" FOREIGN KEY ("moderator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_post_id_fkey" FOREIGN KEY ("target_post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_list_id_fkey" FOREIGN KEY ("target_list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
