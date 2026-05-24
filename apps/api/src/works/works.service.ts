import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetWorksQueryDto } from './works.dto';

type WorkWithDetails = Prisma.WorkGetPayload<{
  include: {
    movie: true;
    show: true;
    book: true;
    rateable: {
      select: {
        ratings: {
          select: {
            value: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: GetWorksQueryDto) {
    const where = this.buildWhere(query);
    const [works, total] = await this.prisma.$transaction([
      this.prisma.work.findMany({
        where,
        include: {
          movie: true,
          show: true,
          book: true,
          rateable: {
            select: {
              ratings: {
                select: {
                  value: true,
                },
              },
            },
          },
        },
        orderBy: [{ releaseYear: 'desc' }, { title: 'asc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.work.count({ where }),
    ]);

    return {
      items: works.map((work) => this.toListItem(work)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findOne(id: string) {
    const work = await this.prisma.work.findFirst({
      where: {
        id,
        kind: {
          in: [WorkKind.movie, WorkKind.show, WorkKind.book],
        },
      },
      include: {
        movie: true,
        show: true,
        book: true,
        rateable: {
          select: {
            ratings: {
              select: {
                value: true,
              },
            },
          },
        },
      },
    });

    if (!work) {
      throw new NotFoundException('Произведение не найдено');
    }

    return this.toDetails(work);
  }

  private buildWhere(query: GetWorksQueryDto): Prisma.WorkWhereInput {
    const and: Prisma.WorkWhereInput[] = [
      {
        kind: {
          in: [WorkKind.movie, WorkKind.show, WorkKind.book],
        },
      },
    ];

    if (query.kind) {
      and.push({ kind: query.kind });
    }

    if (query.year) {
      and.push({ releaseYear: query.year });
    }

    if (query.search) {
      and.push({
        title: {
          contains: query.search,
          mode: 'insensitive',
        },
      });
    }

    return { AND: and };
  }

  private toListItem(work: WorkWithDetails) {
    return {
      id: work.id,
      kind: work.kind,
      title: work.title,
      originalTitle: work.originalTitle,
      description: work.description,
      releaseYear: work.releaseYear,
      imageUrl: work.imageUrl,
      rating: this.getRatingStats(work.rateable.ratings),
      meta: this.getMeta(work),
    };
  }

  private toDetails(work: WorkWithDetails) {
    return {
      ...this.toListItem(work),
      details:
        work.kind === WorkKind.movie
          ? work.movie
          : work.kind === WorkKind.show
            ? work.show
            : work.book,
    };
  }

  private getRatingStats(ratings: Array<{ value: number }>) {
    if (ratings.length === 0) {
      return {
        average: null,
        count: 0,
      };
    }

    const sum = ratings.reduce((acc, rating) => acc + rating.value, 0);

    return {
      average: Number((sum / ratings.length).toFixed(2)),
      count: ratings.length,
    };
  }

  private getMeta(work: WorkWithDetails) {
    if (work.kind === WorkKind.movie) {
      return {
        runtimeMinutes: work.movie?.runtimeMinutes ?? null,
        directorNames: work.movie?.directorNames ?? null,
        actorNames: work.movie?.actorNames ?? null,
      };
    }

    if (work.kind === WorkKind.show) {
      return {
        firstAirDate: work.show?.firstAirDate ?? null,
        lastAirDate: work.show?.lastAirDate ?? null,
        creatorNames: work.show?.creatorNames ?? null,
        actorNames: work.show?.actorNames ?? null,
      };
    }

    return {
      firstPublishYear: work.book?.firstPublishYear ?? null,
      authorNames: work.book?.authorNames ?? null,
    };
  }
}
