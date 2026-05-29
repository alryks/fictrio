import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { aggregateRateableRating } from '../common/rating-stats';
import { UpsertRatingDto } from './ratings.dto';

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
  ) {}

  async upsertWorkRating(workId: string, userId: string, dto: UpsertRatingDto) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: {
        id: true,
        rateableId: true,
      },
    });

    if (!work) {
      throw new NotFoundException('Произведение не найдено');
    }

    const rating = await this.prisma.rating.upsert({
      where: {
        userId_rateableId: {
          userId,
          rateableId: work.rateableId,
        },
      },
      create: {
        userId,
        rateableId: work.rateableId,
        value: dto.value,
      },
      update: {
        value: dto.value,
      },
    });

    const stats = await aggregateRateableRating(this.prisma, work.rateableId);
    await this.progressService.markWorkCompleted(work.id, userId);

    return {
      id: rating.id,
      value: rating.value,
      rating: stats,
    };
  }

  async deleteWorkRating(workId: string, userId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: {
        id: true,
        rateableId: true,
      },
    });

    if (!work) {
      throw new NotFoundException('Произведение не найдено');
    }

    await this.prisma.$transaction([
      this.prisma.post.deleteMany({
        where: {
          authorUserId: userId,
          rateableId: work.rateableId,
          parentPostId: null,
        },
      }),
      this.prisma.rating.deleteMany({
        where: {
          userId,
          rateableId: work.rateableId,
        },
      }),
    ]);

    const stats = await aggregateRateableRating(this.prisma, work.rateableId);

    return {
      deleted: true,
      rating: stats,
    };
  }
}
