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

const publicRatingInclude = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
} satisfies Prisma.RatingInclude;

type PublicRating = Prisma.RatingGetPayload<{
  include: typeof publicRatingInclude;
}>;

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

  async getWorkReviews(workId: string) {
    const work = await this.getWorkRateable(workId);

    const [reviews, ratings] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: {
          rateableId: work.rateableId,
          parentPostId: null,
          isHidden: false,
        },
        include: publicReviewInclude,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.rating.findMany({
        where: {
          rateableId: work.rateableId,
          user: {
            posts: {
              none: {
                rateableId: work.rateableId,
                parentPostId: null,
                isHidden: false,
              },
            },
          },
        },
        include: publicRatingInclude,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      items: [
        ...reviews.map((review) => this.toPublicReview(review)),
        ...ratings.map((rating) => this.toPublicRating(rating)),
      ].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      ),
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

  async getReviewComments(postId: string) {
    await this.getPublicReview(postId);

    const comments = await this.prisma.post.findMany({
      where: {
        parentPostId: postId,
        isHidden: false,
      },
      include: publicCommentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: comments.map((comment) => this.toPublicComment(comment)),
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

  private toPublicRating(rating: PublicRating) {
    return {
      id: rating.id,
      kind: 'rating' as const,
      body: null,
      isHidden: false,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
      author: rating.user,
      rating: rating.value,
      commentsCount: 0,
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
