import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mapPostWriteError } from '../common/prisma-errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import { canModerate } from '../auth/roles';
import {
  CreateCommentDto,
  CreateReviewDto,
  GetPostsPageQueryDto,
  ModeratePostDto,
  UpdateCommentDto,
  UpdateReviewDto,
} from './posts.dto';

const publicReviewInclude = {
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  _count: {
    select: {
      comments: {
        where: {
          isHidden: false,
        },
      },
    },
  },
} satisfies Prisma.PostInclude;

type PublicReview = Prisma.PostGetPayload<{
  include: typeof publicReviewInclude;
}>;

/**
 * Row shape returned by the UNION ALL between reviews and bare ratings
 * inside getWorkReviews. The two branches share a common projection so
 * the result can be mapped to the public activity item shape directly.
 */
type ActivityRow = {
  id: string;
  kind: 'review' | 'rating';
  body: string | null;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  username: string;
  displayName: string;
  rating: number | null;
  commentsCount: number;
};

type TotalRow = { total: bigint };

const publicCommentInclude = {
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  parentPost: {
    select: {
      rateableId: true,
    },
  },
} satisfies Prisma.PostInclude;

type PublicComment = Prisma.PostGetPayload<{
  include: typeof publicCommentInclude;
}>;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkReviews(
    workId: string,
    query: GetPostsPageQueryDto,
    viewer?: AuthenticatedUser,
  ) {
    const work = await this.getWorkRateable(workId);
    const { rateableId } = work;

    // A review is visible when it is not hidden, or the viewer is a moderator,
    // or the viewer is its own author. Bare ratings (a rating without a review)
    // are only emitted when the matching review is *not* visible, so a hidden
    // review shown to its author/a moderator is never duplicated as a rating.
    const reviewVisible = this.postVisibleSql('p', viewer);
    const commentVisible = this.postVisibleSql('c', viewer);

    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<ActivityRow[]>`
        SELECT
          p.id,
          'review'::text AS kind,
          p.body,
          p.is_hidden                    AS "isHidden",
          p.created_at                   AS "createdAt",
          p.updated_at                   AS "updatedAt",
          p.author_user_id               AS "authorId",
          u.username,
          u.display_name                 AS "displayName",
          (SELECT r.value
             FROM ratings r
            WHERE r.user_id = p.author_user_id
              AND r.rateable_id = p.rateable_id) AS rating,
          (SELECT COUNT(*)::int
             FROM posts c
            WHERE c.parent_post_id = p.id
              AND ${commentVisible})              AS "commentsCount"
        FROM posts p
        JOIN users u ON u.id = p.author_user_id
        WHERE p.rateable_id    = ${rateableId}::uuid
          AND p.parent_post_id IS NULL
          AND ${reviewVisible}

        UNION ALL

        SELECT
          r.id,
          'rating'::text                 AS kind,
          NULL                           AS body,
          false                          AS "isHidden",
          r.created_at                   AS "createdAt",
          r.updated_at                   AS "updatedAt",
          r.user_id                      AS "authorId",
          u.username,
          u.display_name                 AS "displayName",
          r.value                        AS rating,
          0                              AS "commentsCount"
        FROM ratings r
        JOIN users u ON u.id = r.user_id
        WHERE r.rateable_id = ${rateableId}::uuid
          AND NOT EXISTS (
            SELECT 1
              FROM posts p
             WHERE p.author_user_id = r.user_id
               AND p.rateable_id    = r.rateable_id
               AND p.parent_post_id IS NULL
               AND ${reviewVisible}
          )

        ORDER BY "createdAt" DESC, id
        LIMIT ${query.limit}
        OFFSET ${query.offset}
      `,
      this.prisma.$queryRaw<TotalRow[]>`
        SELECT
          (SELECT COUNT(*)
             FROM posts p
            WHERE p.rateable_id    = ${rateableId}::uuid
              AND p.parent_post_id IS NULL
              AND ${reviewVisible})
          +
          (SELECT COUNT(*)
             FROM ratings r
            WHERE r.rateable_id = ${rateableId}::uuid
              AND NOT EXISTS (
                SELECT 1
                  FROM posts p
                 WHERE p.author_user_id = r.user_id
                   AND p.rateable_id    = r.rateable_id
                   AND p.parent_post_id IS NULL
                   AND ${reviewVisible}
              )) AS total
      `,
    ]);

    return {
      items: rows.map((row) => this.toActivityItem(row)),
      total: Number(totalRows[0]?.total ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  private toActivityItem(row: ActivityRow) {
    return {
      id: row.id,
      kind: row.kind,
      body: row.body,
      isHidden: row.isHidden,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: {
        id: row.authorId,
        username: row.username,
        displayName: row.displayName,
      },
      rating: row.rating,
      commentsCount: row.commentsCount,
    };
  }

  async createWorkReview(workId: string, userId: string, dto: CreateReviewDto) {
    const work = await this.getWorkRateable(workId);

    try {
      const review = await this.prisma.post.create({
        data: {
          authorUserId: userId,
          rateableId: work.rateableId,
          body: dto.body,
        },
        include: publicReviewInclude,
      });

      return await this.toPublicReview(review);
    } catch (error) {
      mapPostWriteError(error);
    }
  }

  async updateReview(postId: string, userId: string, dto: UpdateReviewDto) {
    const review = await this.getEditablePost(postId, userId, 'review');

    try {
      const updatedReview = await this.prisma.post.update({
        where: {
          id: review.id,
        },
        data: {
          body: dto.body,
        },
        include: publicReviewInclude,
      });

      return await this.toPublicReview(updatedReview);
    } catch (error) {
      mapPostWriteError(error);
    }
  }

  async deleteReview(postId: string, userId: string) {
    const review = await this.getEditablePost(postId, userId, 'review');

    await this.prisma.post.delete({
      where: {
        id: review.id,
      },
    });

    return {
      deleted: true,
    };
  }

  async getReviewComments(
    postId: string,
    query: GetPostsPageQueryDto,
    viewer?: AuthenticatedUser,
  ) {
    await this.getViewableReview(postId, viewer);

    const where: Prisma.PostWhereInput = {
      parentPostId: postId,
      ...this.postVisibleWhere(viewer),
    };

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: publicCommentInclude,
        orderBy: {
          createdAt: 'desc',
        },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: await Promise.all(
        comments.map((comment) => this.toPublicComment(comment)),
      ),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createReviewComment(
    postId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    await this.getPublicReview(postId);

    try {
      const comment = await this.prisma.post.create({
        data: {
          authorUserId: userId,
          parentPostId: postId,
          body: dto.body,
        },
        include: publicCommentInclude,
      });

      return await this.toPublicComment(comment);
    } catch (error) {
      mapPostWriteError(error);
    }
  }

  async updateComment(postId: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.getEditablePost(postId, userId, 'comment');

    try {
      const updatedComment = await this.prisma.post.update({
        where: {
          id: comment.id,
        },
        data: {
          body: dto.body,
        },
        include: publicCommentInclude,
      });

      return await this.toPublicComment(updatedComment);
    } catch (error) {
      mapPostWriteError(error);
    }
  }

  async deleteComment(postId: string, userId: string) {
    const comment = await this.getEditablePost(postId, userId, 'comment');

    await this.prisma.post.delete({
      where: {
        id: comment.id,
      },
    });

    return {
      deleted: true,
    };
  }

  private async getWorkRateable(workId: string) {
    const work = await this.prisma.work.findUnique({
      where: {
        id: workId,
      },
      select: {
        id: true,
        rateableId: true,
      },
    });

    if (!work) {
      throw new NotFoundException('Произведение не найдено');
    }

    return work;
  }

  private async getEditablePost(
    postId: string,
    userId: string,
    kind: 'review' | 'comment',
  ) {
    const post = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        id: true,
        authorUserId: true,
        parentPostId: true,
      },
    });

    const isReview = kind === 'review';
    // A review is a top-level post (no parent); a comment has a parent.
    const wrongShape = isReview
      ? post?.parentPostId !== null
      : post?.parentPostId === null;

    if (!post || wrongShape) {
      throw new NotFoundException(
        isReview ? 'Отзыв не найден' : 'Комментарий не найден',
      );
    }

    if (post.authorUserId !== userId) {
      throw new ForbiddenException(
        isReview
          ? 'Можно изменять только собственный отзыв'
          : 'Можно изменять только собственный комментарий',
      );
    }

    return post;
  }

  private async getPublicReview(postId: string) {
    const review = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        id: true,
        parentPostId: true,
        isHidden: true,
      },
    });

    if (!review || review.parentPostId !== null || review.isHidden) {
      throw new NotFoundException('Отзыв не найден');
    }

    return review;
  }

  /**
   * Like getPublicReview, but a hidden review is still visible to a moderator
   * or to its own author, so they can read (and moderate) the thread that
   * ordinary users no longer see.
   */
  private async getViewableReview(postId: string, viewer?: AuthenticatedUser) {
    const review = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        id: true,
        parentPostId: true,
        isHidden: true,
        authorUserId: true,
      },
    });

    const hiddenFromViewer =
      review?.isHidden &&
      !canModerate(viewer) &&
      review.authorUserId !== viewer?.id;

    if (!review || review.parentPostId !== null || hiddenFromViewer) {
      throw new NotFoundException('Отзыв не найден');
    }

    return review;
  }

  async moderatePost(
    postId: string,
    moderator: AuthenticatedUser,
    dto: ModeratePostDto,
    kind: 'review' | 'comment',
  ) {
    const post = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        id: true,
        parentPostId: true,
      },
    });

    const isReview = kind === 'review';
    const wrongShape = isReview
      ? post?.parentPostId !== null
      : post?.parentPostId === null;

    if (!post || wrongShape) {
      throw new NotFoundException(
        isReview ? 'Отзыв не найден' : 'Комментарий не найден',
      );
    }

    // moderate_post hides/restores the post and logs the action atomically.
    await this.prisma.$executeRaw`
      CALL moderate_post(
        ${moderator.id}::uuid,
        ${postId}::uuid,
        ${dto.action}::moderation_action_kind,
        ${dto.reason ?? null}
      )
    `;

    return {
      id: postId,
      isHidden: dto.action === 'hide',
    };
  }

  /**
   * SQL predicate for a post being visible to the viewer: not hidden, or the
   * viewer is a moderator, or the viewer authored it. `alias` is the post
   * relation alias in the surrounding query.
   */
  private postVisibleSql(alias: string, viewer?: AuthenticatedUser) {
    const ref = Prisma.raw(alias);
    const viewerId = viewer?.id ?? null;

    return Prisma.sql`(${ref}.is_hidden = false OR ${canModerate(viewer)} OR ${ref}.author_user_id = ${viewerId}::uuid)`;
  }

  /** Prisma `where` fragment mirroring postVisibleSql for findMany queries. */
  private postVisibleWhere(viewer?: AuthenticatedUser): Prisma.PostWhereInput {
    if (canModerate(viewer)) {
      return {};
    }

    const or: Prisma.PostWhereInput[] = [{ isHidden: false }];

    if (viewer?.id) {
      or.push({ authorUserId: viewer.id });
    }

    return { OR: or };
  }

  private async toPublicReview(review: PublicReview) {
    const authorRating = review.rateableId
      ? await this.getAuthorRating(review.rateableId, review.authorUserId)
      : null;

    return {
      id: review.id,
      kind: 'review' as const,
      body: review.body,
      isHidden: review.isHidden,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      author: review.author,
      rating: authorRating,
      commentsCount: review._count.comments,
    };
  }

  private async toPublicComment(comment: PublicComment) {
    const rateableId = comment.parentPost?.rateableId ?? null;
    const authorRating = rateableId
      ? await this.getAuthorRating(rateableId, comment.authorUserId)
      : null;

    return {
      id: comment.id,
      body: comment.body,
      isHidden: comment.isHidden,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author,
      rating: authorRating,
    };
  }

  /**
   * Fetches just the author's own rating for a rateable, instead of loading
   * every rating row to find one. Mirrors the scalar subquery in
   * getWorkReviews.
   */
  private async getAuthorRating(
    rateableId: string,
    authorUserId: string,
  ): Promise<number | null> {
    const rating = await this.prisma.rating.findUnique({
      where: {
        userId_rateableId: {
          userId: authorUserId,
          rateableId,
        },
      },
      select: {
        value: true,
      },
    });

    return rating?.value ?? null;
  }
}
