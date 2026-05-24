import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertRatingDto } from './ratings.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const stats = await this.getRateableRatingStats(work.rateableId);

    return {
      id: rating.id,
      value: rating.value,
      rating: stats,
    };
  }

  private async getRateableRatingStats(rateableId: string) {
    const aggregate = await this.prisma.rating.aggregate({
      where: {
        rateableId,
      },
      _avg: {
        value: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      average:
        aggregate._avg.value === null
          ? null
          : Number(aggregate._avg.value.toFixed(2)),
      count: aggregate._count.id,
    };
  }
}
