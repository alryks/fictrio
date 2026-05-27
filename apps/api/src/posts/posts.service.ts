import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCommentDto,
  CreateReviewDto,
  GetPostsPageQueryDto,
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
  rateable: {
    select: {
      ratings: {
        select: {
          userId: true,
          value: true,
        },
      },
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
      rateable: {
        select: {
          ratings: {
            select: {
              userId: true,
              value: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PostInclude;

type PublicComment = Prisma.PostGetPayload<{
  include: typeof publicCommentInclude;
}>;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkReviews(workId: string, query: GetPostsPageQueryDto) {
    const work = await this.getWorkRateable(workId);
    const { rateableId } = work;

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
              AND c.is_hidden = false)          AS "commentsCount"
        FROM posts p
        JOIN users u ON u.id = p.author_user_id
        WHERE p.rateable_id    = ${rateableId}::uuid
          AND p.parent_post_id IS NULL
          AND p.is_hidden      = false

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
               AND p.is_hidden      = false
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
              AND p.is_hidden      = false)
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
                   AND p.is_hidden      = false
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

      return this.toPublicReview(review);
    } catch (error) {
      this.rethrowPostWriteError(error);
      throw error;
    }
  }

  async updateReview(postId: string, userId: string, dto: UpdateReviewDto) {
    const review = await this.getEditableReview(postId, userId);

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

      return this.toPublicReview(updatedReview);
    } catch (error) {
      this.rethrowPostWriteError(error);
      throw error;
    }
  }

  async deleteReview(postId: string, userId: string) {
    const review = await this.getEditableReview(postId, userId);

    await this.prisma.post.delete({
      where: {
        id: review.id,
      },
    });

    return {
      deleted: true,
    };
  }

  async getReviewComments(postId: string, query: GetPostsPageQueryDto) {
    await this.getPublicReview(postId);

    const where = {
      parentPostId: postId,
      isHidden: false,
    } satisfies Prisma.PostWhereInput;

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
      items: comments.map((comment) => this.toPublicComment(comment)),
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

      return this.toPublicComment(comment);
    } catch (error) {
      this.rethrowPostWriteError(error);
      throw error;
    }
  }

  async updateComment(postId: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.getEditableComment(postId, userId);

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

      return this.toPublicComment(updatedComment);
    } catch (error) {
      this.rethrowPostWriteError(error);
      throw error;
    }
  }

  async deleteComment(postId: string, userId: string) {
    const comment = await this.getEditableComment(postId, userId);

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

  private async getEditableReview(postId: string, userId: string) {
    const review = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        id: true,
        authorUserId: true,
        parentPostId: true,
      },
    });

    if (!review || review.parentPostId !== null) {
      throw new NotFoundException('Отзыв не найден');
    }

    if (review.authorUserId !== userId) {
      throw new ForbiddenException('Можно изменять только собственный отзыв');
    }

    return review;
  }

  private async getEditableComment(postId: string, userId: string) {
    const comment = await this.prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        id: true,
        authorUserId: true,
        parentPostId: true,
      },
    });

    if (!comment || comment.parentPostId === null) {
      throw new NotFoundException('Комментарий не найден');
    }

    if (comment.authorUserId !== userId) {
      throw new ForbiddenException(
        'Можно изменять только собственный комментарий',
      );
    }

    return comment;
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

  private toPublicReview(review: PublicReview) {
    const authorRating =
      review.rateable?.ratings.find(
        (rating) => rating.userId === review.authorUserId,
      )?.value ?? null;

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

  private toPublicComment(comment: PublicComment) {
    const authorRating =
      comment.parentPost?.rateable?.ratings.find(
        (rating) => rating.userId === comment.authorUserId,
      )?.value ?? null;

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

  private rethrowPostWriteError(error: unknown): never | void {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      if (
        error instanceof Prisma.PrismaClientUnknownRequestError &&
        error.message.includes(
          'Review requires an existing rating by the same user for the same rateable object',
        )
      ) {
        throw new BadRequestException(
          'Отзыв можно создать только после выставления оценки',
        );
      }

      return;
    }

    if (error.code === 'P2002') {
      throw new BadRequestException(
        'Пользователь уже оставил отзыв на этот объект',
      );
    }

    if (error.code === 'P2003') {
      throw new BadRequestException('Некорректная ссылка на объект отзыва');
    }

    if (error.code === 'P2004') {
      throw new BadRequestException(
        'Отзыв можно создать только после выставления оценки',
      );
    }
  }
}
