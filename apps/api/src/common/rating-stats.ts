import { PrismaService } from '../prisma/prisma.service';

export interface RatingStats {
  average: number | null;
  count: number;
}

export function averageFromValues(
  values: Array<{ value: number }>,
): RatingStats {
  if (values.length === 0) {
    return {
      average: null,
      count: 0,
    };
  }

  const sum = values.reduce((acc, rating) => acc + rating.value, 0);

  return {
    average: Number((sum / values.length).toFixed(2)),
    count: values.length,
  };
}

export async function aggregateRateableRating(
  prisma: PrismaService,
  rateableId: string,
): Promise<RatingStats> {
  const aggregate = await prisma.rating.aggregate({
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
