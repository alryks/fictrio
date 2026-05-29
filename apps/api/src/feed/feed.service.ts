import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FeedItem, FeedPage } from '@fictrio/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { GetFeedQueryDto } from './feed.dto';

/** How many works are previewed inside a list activity card. */
const FEED_LIST_ITEMS_LIMIT = 6;

type FeedRow = { payload: FeedItem };
type TotalRow = { total: number };

/**
 * Activity feed assembled from three sources merged by recency:
 *   - reviews (top-level posts) on works;
 *   - bare ratings on works (a rating without an accompanying review);
 *   - public lists created by the actor(s).
 *
 * The review/rating branch mirrors the work-page reviews query: a rating that
 * already has a review is folded into the review row, never shown twice. The
 * JOIN to `works` naturally drops ratings cast on lists, which have no work.
 */
@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserFeed(
    username: string,
    query: GetFeedQueryDto,
    viewerId?: string,
  ): Promise<FeedPage> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Пользователь не найден');
    }

    return this.buildFeed([user.id], query, viewerId);
  }

  async getFollowingFeed(
    viewerId: string,
    query: GetFeedQueryDto,
  ): Promise<FeedPage> {
    const follows = await this.prisma.follow.findMany({
      where: { followerUserId: viewerId },
      select: { followedUserId: true },
    });

    return this.buildFeed(
      follows.map((follow) => follow.followedUserId),
      query,
      viewerId,
    );
  }

  private async buildFeed(
    actorIds: string[],
    query: GetFeedQueryDto,
    viewerId?: string,
  ): Promise<FeedPage> {
    if (actorIds.length === 0) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }

    const includePosts = query.filter !== 'lists';
    const includeLists = query.filter !== 'posts';

    const rowBranches: Prisma.Sql[] = [];
    const countBranches: Prisma.Sql[] = [];

    if (includePosts) {
      rowBranches.push(this.postRowsSql(actorIds));
      countBranches.push(this.postCountSql(actorIds));
    }

    if (includeLists) {
      rowBranches.push(this.listRowsSql(actorIds, viewerId));
      countBranches.push(this.listCountSql(actorIds));
    }

    const rowsUnion = Prisma.join(rowBranches, ' UNION ALL ');
    const countUnion = Prisma.join(countBranches, ' UNION ALL ');

    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<FeedRow[]>`
        SELECT payload
        FROM ( ${rowsUnion} ) feed
        ORDER BY created_at DESC, activity_id DESC
        LIMIT ${query.limit}
        OFFSET ${query.offset}
      `,
      this.prisma.$queryRaw<TotalRow[]>`
        SELECT COUNT(*)::int AS total
        FROM ( ${countUnion} ) feed
      `,
    ]);

    return {
      items: rows.map((row) => row.payload),
      total: Number(totalRows[0]?.total ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  private postRowsSql(actorIds: string[]): Prisma.Sql {
    return Prisma.sql`
      SELECT
        a.activity_id,
        a.created_at,
        jsonb_build_object(
          'kind', 'post',
          'id', a.activity_id,
          'createdAt', a.created_at,
          'actor', jsonb_build_object(
            'id', u.id, 'username', u.username, 'displayName', u.display_name
          ),
          'postKind', a.post_kind,
          'reviewId', a.review_id,
          'body', a.body,
          'rating', a.rating,
          'commentsCount', a.comments_count,
          'work', jsonb_build_object(
            'id', w.id, 'kind', w.kind, 'title', w.title,
            'originalTitle', w.original_title, 'description', w.description,
            'releaseYear', w.release_year, 'imageUrl', w.image_url,
            'rating', jsonb_build_object(
              'average', wr.average_rating, 'count', wr.rating_count
            ),
            'meta', '{}'::jsonb
          )
        ) AS payload
      FROM ( ${this.postActivitySql(actorIds)} ) a
      JOIN users u ON u.id = a.actor_id
      JOIN works w ON w.rateable_id = a.rateable_id
      LEFT JOIN LATERAL (
        SELECT
          round(AVG(x.value)::numeric, 2)::float AS average_rating,
          COUNT(x.id)::int AS rating_count
        FROM ratings x
        WHERE x.rateable_id = a.rateable_id
      ) wr ON true
    `;
  }

  private postCountSql(actorIds: string[]): Prisma.Sql {
    return Prisma.sql`
      SELECT a.activity_id
      FROM ( ${this.postActivitySql(actorIds)} ) a
      JOIN works w ON w.rateable_id = a.rateable_id
    `;
  }

  /** Reviews and bare (review-less) ratings authored by the given users. */
  private postActivitySql(actorIds: string[]): Prisma.Sql {
    return Prisma.sql`
      SELECT
        p.id              AS activity_id,
        p.created_at      AS created_at,
        p.author_user_id  AS actor_id,
        p.rateable_id     AS rateable_id,
        'review'::text    AS post_kind,
        p.id              AS review_id,
        p.body            AS body,
        (SELECT r.value FROM ratings r
          WHERE r.user_id = p.author_user_id
            AND r.rateable_id = p.rateable_id) AS rating,
        (SELECT COUNT(*)::int FROM posts c
          WHERE c.parent_post_id = p.id
            AND c.is_hidden = false) AS comments_count
      FROM posts p
      WHERE p.parent_post_id IS NULL
        AND p.is_hidden = false
        AND p.author_user_id = ANY(${actorIds}::uuid[])

      UNION ALL

      SELECT
        r.id           AS activity_id,
        r.created_at   AS created_at,
        r.user_id      AS actor_id,
        r.rateable_id  AS rateable_id,
        'rating'::text AS post_kind,
        NULL::uuid     AS review_id,
        NULL::text     AS body,
        r.value        AS rating,
        0              AS comments_count
      FROM ratings r
      WHERE r.user_id = ANY(${actorIds}::uuid[])
        AND NOT EXISTS (
          SELECT 1 FROM posts p
          WHERE p.author_user_id = r.user_id
            AND p.rateable_id = r.rateable_id
            AND p.parent_post_id IS NULL
            AND p.is_hidden = false
        )
    `;
  }

  private listRowsSql(actorIds: string[], viewerId?: string): Prisma.Sql {
    const userRatingSql = viewerId
      ? Prisma.sql`(SELECT x.value FROM ratings x
          WHERE x.rateable_id = l.rateable_id AND x.user_id = ${viewerId}::uuid)`
      : Prisma.sql`NULL::int`;

    return Prisma.sql`
      SELECT
        l.id AS activity_id,
        l.created_at,
        jsonb_build_object(
          'kind', 'list',
          'id', l.id,
          'createdAt', l.created_at,
          'actor', jsonb_build_object(
            'id', u.id, 'username', u.username, 'displayName', u.display_name
          ),
          'list', jsonb_build_object(
            'id', l.id,
            'title', l.title,
            'description', l.description,
            'visibility', l.visibility,
            'createdAt', l.created_at,
            'updatedAt', l.updated_at,
            'owner', jsonb_build_object(
              'id', u.id, 'username', u.username, 'displayName', u.display_name
            ),
            'rating', jsonb_build_object(
              'average', lr.average_rating, 'count', lr.rating_count
            ),
            'userRating', ${userRatingSql},
            'itemsTotal', (
              SELECT COUNT(*)::int FROM list_items li_total
              WHERE li_total.list_id = l.id
            ),
            'items', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'position', preview_items.position,
                  'addedAt', preview_items.added_at,
                  'work', jsonb_build_object(
                    'id', w.id, 'kind', w.kind, 'title', w.title,
                    'originalTitle', w.original_title,
                    'description', w.description,
                    'releaseYear', w.release_year, 'imageUrl', w.image_url,
                    'rating', jsonb_build_object(
                      'average', work_ratings.average_rating,
                      'count', work_ratings.rating_count
                    ),
                    'meta', '{}'::jsonb
                  )
                )
                ORDER BY preview_items.position
              )
              FROM (
                SELECT li.position, li.added_at, li.work_id
                FROM list_items li
                WHERE li.list_id = l.id
                ORDER BY li.position
                LIMIT ${FEED_LIST_ITEMS_LIMIT}
              ) preview_items
              JOIN works w ON w.id = preview_items.work_id
              JOIN rateables wrt ON wrt.id = w.rateable_id
              LEFT JOIN LATERAL (
                SELECT
                  round(AVG(x.value)::numeric, 2)::float AS average_rating,
                  COUNT(x.id)::int AS rating_count
                FROM ratings x
                WHERE x.rateable_id = wrt.id
              ) work_ratings ON true
            ), '[]'::jsonb)
          )
        ) AS payload
      FROM lists l
      JOIN users u ON u.id = l.owner_user_id
      LEFT JOIN LATERAL (
        SELECT
          round(AVG(x.value)::numeric, 2)::float AS average_rating,
          COUNT(x.id)::int AS rating_count
        FROM ratings x
        WHERE x.rateable_id = l.rateable_id
      ) lr ON true
      WHERE l.owner_user_id = ANY(${actorIds}::uuid[])
        AND l.is_hidden = false
        AND l.visibility = 'public'
    `;
  }

  private listCountSql(actorIds: string[]): Prisma.Sql {
    return Prisma.sql`
      SELECT l.id AS activity_id
      FROM lists l
      WHERE l.owner_user_id = ANY(${actorIds}::uuid[])
        AND l.is_hidden = false
        AND l.visibility = 'public'
    `;
  }
}
