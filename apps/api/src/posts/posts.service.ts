import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto, UpdateReviewDto } from './posts.dto';

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
      comments: true,
    },
  },
} satisfies Prisma.PostInclude;

type PublicReview = Prisma.PostGetPayload<{
  include: typeof publicReviewInclude;
}>;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkReviews(workId: string) {
    const work = await this.getWorkRateable(workId);

    const reviews = await this.prisma.post.findMany({
      where: {
        rateableId: work.rateableId,
        parentPostId: null,
        isHidden: false,
      },
      include: publicReviewInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: reviews.map((review) => this.toPublicReview(review)),
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

  private toPublicReview(review: PublicReview) {
    const authorRating =
      review.rateable?.ratings.find(
        (rating) => rating.userId === review.authorUserId,
      )?.value ?? null;

    return {
      id: review.id,
      body: review.body,
      isHidden: review.isHidden,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      author: review.author,
      rating: authorRating,
      commentsCount: review._count.comments,
    };
  }

  private rethrowPostWriteError(error: unknown): never | void {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
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
