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

type WorkListRow = {
  id: string;
  kind: WorkKind;
  title: string;
  originalTitle: string | null;
  description: string | null;
  releaseYear: number | null;
  imageUrl: string | null;
  averageRating: number | null;
  ratingCount: bigint;
  runtimeMinutes: number | null;
  directorNames: string | null;
  movieActorNames: string | null;
  firstAirDate: Date | null;
  lastAirDate: Date | null;
  creatorNames: string | null;
  showActorNames: string | null;
  firstPublishYear: number | null;
  authorNames: string | null;
};

type CountRow = {
  count: bigint;
};

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: GetWorksQueryDto) {
    const whereSql = this.buildListWhereSql(query);
    const havingSql = this.buildListHavingSql(query);
    const orderSql = this.buildOrderSql(query);

    const [works, totalRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<WorkListRow[]>`
        SELECT
          w.id,
          w.kind,
          w.title,
          w.original_title AS "originalTitle",
          w.description,
          w.release_year AS "releaseYear",
          w.image_url AS "imageUrl",
          AVG(r.value)::float AS "averageRating",
          COUNT(r.id) AS "ratingCount",
          m.runtime_minutes AS "runtimeMinutes",
          m.director_names AS "directorNames",
          m.actor_names AS "movieActorNames",
          s.first_air_date AS "firstAirDate",
          s.last_air_date AS "lastAirDate",
          s.creator_names AS "creatorNames",
          s.actor_names AS "showActorNames",
          b.first_publish_year AS "firstPublishYear",
          b.author_names AS "authorNames"
        FROM works w
        JOIN rateables rt ON rt.id = w.rateable_id
        LEFT JOIN ratings r ON r.rateable_id = rt.id
        LEFT JOIN movies m ON m.work_id = w.id
        LEFT JOIN shows s ON s.work_id = w.id
        LEFT JOIN books b ON b.work_id = w.id
        ${whereSql}
        GROUP BY w.id, m.work_id, s.work_id, b.work_id
        ${havingSql}
        ${orderSql}
        LIMIT ${query.limit}
        OFFSET ${query.offset}
      `,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS count
        FROM (
          SELECT w.id
          FROM works w
          JOIN rateables rt ON rt.id = w.rateable_id
          LEFT JOIN ratings r ON r.rateable_id = rt.id
          ${whereSql}
          GROUP BY w.id
          ${havingSql}
        ) filtered_works
      `,
    ]);

    return {
      items: works.map((work) => this.toListRowItem(work)),
      total: Number(totalRows[0]?.count ?? 0),
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

  private buildListWhereSql(query: GetWorksQueryDto) {
    const and: Prisma.Sql[] = [
      Prisma.sql`w.kind = ANY(ARRAY[${Prisma.join([
        WorkKind.movie,
        WorkKind.show,
        WorkKind.book,
      ])}]::work_kind[])`,
    ];

    if (query.kinds?.length) {
      and.push(
        Prisma.sql`w.kind = ANY(ARRAY[${Prisma.join(query.kinds)}]::work_kind[])`,
      );
    }

    if (query.yearFrom !== undefined) {
      and.push(Prisma.sql`w.release_year >= ${query.yearFrom}`);
    }

    if (query.yearTo !== undefined) {
      and.push(Prisma.sql`w.release_year <= ${query.yearTo}`);
    }

    if (query.search) {
      and.push(Prisma.sql`w.title ILIKE ${`%${query.search}%`}`);
    }

    return Prisma.sql`WHERE ${Prisma.join(and, ' AND ')}`;
  }

  private buildListHavingSql(query: GetWorksQueryDto) {
    if (query.minRating === undefined || query.minRating <= 0) {
      return Prisma.empty;
    }

    return Prisma.sql`HAVING AVG(r.value) >= ${query.minRating}`;
  }

  private buildOrderSql(query: GetWorksQueryDto) {
    const direction =
      query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    if (query.sortBy === 'title') {
      return Prisma.sql`ORDER BY w.title ${direction}, w.release_year DESC NULLS LAST`;
    }

    if (query.sortBy === 'averageRating') {
      return Prisma.sql`ORDER BY AVG(r.value) ${direction} NULLS LAST, w.title ASC`;
    }

    return Prisma.sql`ORDER BY w.release_year ${direction} NULLS LAST, w.title ASC`;
  }

  private toListRowItem(work: WorkListRow) {
    return {
      id: work.id,
      kind: work.kind,
      title: work.title,
      originalTitle: work.originalTitle,
      description: work.description,
      releaseYear: work.releaseYear,
      imageUrl: work.imageUrl,
      rating: {
        average:
          work.averageRating === null
            ? null
            : Number(work.averageRating.toFixed(2)),
        count: Number(work.ratingCount),
      },
      meta: this.getRowMeta(work),
    };
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

  private getRowMeta(work: WorkListRow) {
    if (work.kind === WorkKind.movie) {
      return {
        runtimeMinutes: work.runtimeMinutes,
        directorNames: work.directorNames,
        actorNames: work.movieActorNames,
      };
    }

    if (work.kind === WorkKind.show) {
      return {
        firstAirDate: work.firstAirDate,
        lastAirDate: work.lastAirDate,
        creatorNames: work.creatorNames,
        actorNames: work.showActorNames,
      };
    }

    return {
      firstPublishYear: work.firstPublishYear,
      authorNames: work.authorNames,
    };
  }
}
