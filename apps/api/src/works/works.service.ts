import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { RatingStats } from '../common/rating-stats';
import { GetWorksQueryDto } from './works.dto';
import { WorksCacheService } from './works-cache.service';

/** Shared include for a work detail and its nested seasons/episodes. */
const workDetailInclude = Prisma.validator<Prisma.WorkInclude>()({
  movie: true,
  show: {
    include: {
      seasons: {
        include: {
          work: true,
          episodes: {
            include: {
              work: true,
            },
            orderBy: {
              episodeNumber: 'asc',
            },
          },
        },
        orderBy: {
          seasonNumber: 'asc',
        },
      },
    },
  },
  season: {
    include: {
      episodes: {
        include: {
          work: true,
        },
        orderBy: {
          episodeNumber: 'asc',
        },
      },
    },
  },
  episode: true,
  book: true,
});

type WorkWithDetails = Prisma.WorkGetPayload<{
  include: typeof workDetailInclude;
}>;

/** Scalar columns shared by every work projection. */
type WorkScalars = {
  id: string;
  kind: WorkKind;
  title: string;
  originalTitle: string | null;
  description: string | null;
  releaseYear: number | null;
  imageUrl: string | null;
};

type WorkMetaValue = string | number | Date | null;
type WorkMeta = Record<string, WorkMetaValue>;

/** Normalized source for meta, fed either by relations or a raw list row. */
type WorkMetaSource = {
  kind: WorkKind;
  movie?: {
    runtimeMinutes: number | null;
    directorNames: string | null;
    actorNames: string | null;
  } | null;
  show?: {
    firstAirDate: Date | null;
    lastAirDate: Date | null;
    creatorNames: string | null;
    actorNames: string | null;
  } | null;
  season?: {
    seasonNumber: number | null;
    airDate: Date | null;
  } | null;
  episode?: {
    episodeNumber: number | null;
    airDate: Date | null;
    runtimeMinutes: number | null;
    directorNames: string | null;
    actorNames: string | null;
  } | null;
  book?: {
    firstPublishYear: number | null;
    authorNames: string | null;
  } | null;
};

type WorkListRow = WorkScalars & {
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly cache: WorksCacheService,
  ) {}

  findMany(query: GetWorksQueryDto) {
    return this.cache.cacheList(query, () => this.queryMany(query));
  }

  private async queryMany(query: GetWorksQueryDto) {
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

  async findOne(workId: string, userId?: string) {
    // The shared card (metadata + rating aggregates + nested seasons) is the
    // same for everyone, so it is cached. `userProgress` is per-user, never
    // cached, and merged onto the cached payload on each request.
    const detail = await this.cache.cacheDetail(workId, () =>
      this.loadDetail(workId),
    );
    const userProgress = userId
      ? await this.progressService.getWorkProgress(workId, userId)
      : null;
    return { ...detail, userProgress };
  }

  private async loadDetail(workId: string) {
    const work = await this.prisma.work.findFirst({
      where: {
        id: workId,
      },
      include: workDetailInclude,
    });

    if (!work) {
      throw new NotFoundException('Произведение не найдено');
    }

    const ratings = await this.loadRatingStats(work);
    return this.toDetails(work, ratings);
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
      // Uses the `works_search_gin_idx` GIN index on
      // to_tsvector('russian', coalesce(title)||' '||coalesce(original_title)||' '||coalesce(description)).
      // websearch_to_tsquery handles user input safely (quoted phrases,
      // OR keywords, exclusions) without exposing tsquery syntax.
      and.push(Prisma.sql`
        to_tsvector(
          'russian',
          coalesce(w.title, '') || ' ' ||
          coalesce(w.original_title, '') || ' ' ||
          coalesce(w.description, '')
        ) @@ websearch_to_tsquery('russian', ${query.search})
      `);
    }

    return Prisma.sql`WHERE ${Prisma.join(and, ' AND ')}`;
  }

  private buildListHavingSql(query: GetWorksQueryDto) {
    const and: Prisma.Sql[] = [];

    if (query.minRating !== undefined && query.minRating > 0) {
      and.push(Prisma.sql`AVG(r.value) >= ${query.minRating}`);
    }

    if (query.minRatingsCount !== undefined && query.minRatingsCount > 0) {
      and.push(Prisma.sql`COUNT(r.id) >= ${query.minRatingsCount}`);
    }

    if (and.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`HAVING ${Prisma.join(and, ' AND ')}`;
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

    if (query.sortBy === 'ratingCount') {
      return Prisma.sql`ORDER BY COUNT(r.id) ${direction}, AVG(r.value) DESC NULLS LAST, w.title ASC`;
    }

    return Prisma.sql`ORDER BY w.release_year ${direction} NULLS LAST, w.title ASC`;
  }

  /**
   * Builds the public work-item shape from the scalar columns shared by
   * every source (raw list rows, included work payloads, relation works)
   * plus a precomputed rating and meta map.
   */
  private buildWorkItem(
    work: WorkScalars,
    rating: RatingStats,
    meta: WorkMeta,
  ) {
    return {
      id: work.id,
      kind: work.kind,
      title: work.title,
      originalTitle: work.originalTitle,
      description: work.description,
      releaseYear: work.releaseYear,
      imageUrl: work.imageUrl,
      rating,
      meta,
    };
  }

  private toListRowItem(work: WorkListRow) {
    return this.buildWorkItem(
      work,
      {
        average:
          work.averageRating === null
            ? null
            : Number(work.averageRating.toFixed(2)),
        count: Number(work.ratingCount),
      },
      this.buildMeta({
        kind: work.kind,
        movie: {
          runtimeMinutes: work.runtimeMinutes,
          directorNames: work.directorNames,
          actorNames: work.movieActorNames,
        },
        show: {
          firstAirDate: work.firstAirDate,
          lastAirDate: work.lastAirDate,
          creatorNames: work.creatorNames,
          actorNames: work.showActorNames,
        },
        book: {
          firstPublishYear: work.firstPublishYear,
          authorNames: work.authorNames,
        },
      }),
    );
  }

  private toDetails(work: WorkWithDetails, ratings: Map<string, RatingStats>) {
    return {
      ...this.buildWorkItem(
        work,
        this.statsFor(ratings, work.rateableId),
        this.buildMeta({
          kind: work.kind,
          movie: work.movie,
          show: work.show,
          season: work.season,
          episode: work.episode,
          book: work.book,
        }),
      ),
      details:
        work.kind === WorkKind.movie
          ? work.movie
          : work.kind === WorkKind.show
            ? {
                tmdbId: work.show?.tmdbId ?? null,
                firstAirDate: work.show?.firstAirDate ?? null,
                lastAirDate: work.show?.lastAirDate ?? null,
                creatorNames: work.show?.creatorNames ?? null,
                actorNames: work.show?.actorNames ?? null,
              }
            : work.kind === WorkKind.season
              ? {
                  tmdbId: work.season?.tmdbId ?? null,
                  seasonNumber: work.season?.seasonNumber ?? null,
                  airDate: work.season?.airDate ?? null,
                }
              : work.kind === WorkKind.episode
                ? work.episode
                : work.book,
      seasons:
        work.kind === WorkKind.show
          ? (work.show?.seasons.map((season) => ({
              ...this.toRelationWorkItem(season.work, ratings),
              episodes: season.episodes.map((episode) =>
                this.toRelationWorkItem(episode.work, ratings),
              ),
            })) ?? [])
          : undefined,
      episodes:
        work.kind === WorkKind.season
          ? (work.season?.episodes.map((episode) =>
              this.toRelationWorkItem(episode.work, ratings),
            ) ?? [])
          : undefined,
    };
  }

  private toRelationWorkItem(
    work: WorkScalars & { rateableId: string },
    ratings: Map<string, RatingStats>,
  ) {
    return this.buildWorkItem(
      work,
      this.statsFor(ratings, work.rateableId),
      {},
    );
  }

  /**
   * Aggregates rating average/count for the work plus every nested season
   * and episode in a single grouped query, so we never fetch raw rating rows.
   */
  private async loadRatingStats(
    work: WorkWithDetails,
  ): Promise<Map<string, RatingStats>> {
    const rateableIds = this.collectRateableIds(work);

    const grouped = await this.prisma.rating.groupBy({
      by: ['rateableId'],
      where: {
        rateableId: {
          in: rateableIds,
        },
      },
      _avg: {
        value: true,
      },
      _count: {
        id: true,
      },
    });

    const stats = new Map<string, RatingStats>();
    for (const row of grouped) {
      stats.set(row.rateableId, {
        average:
          row._avg.value === null ? null : Number(row._avg.value.toFixed(2)),
        count: row._count.id,
      });
    }

    return stats;
  }

  private collectRateableIds(work: WorkWithDetails): string[] {
    const ids = [work.rateableId];

    if (work.show) {
      for (const season of work.show.seasons) {
        ids.push(season.work.rateableId);
        for (const episode of season.episodes) {
          ids.push(episode.work.rateableId);
        }
      }
    }

    if (work.season) {
      for (const episode of work.season.episodes) {
        ids.push(episode.work.rateableId);
      }
    }

    return ids;
  }

  private statsFor(
    ratings: Map<string, RatingStats>,
    rateableId: string,
  ): RatingStats {
    return ratings.get(rateableId) ?? { average: null, count: 0 };
  }

  private buildMeta(source: WorkMetaSource): WorkMeta {
    if (source.kind === WorkKind.movie) {
      return {
        runtimeMinutes: source.movie?.runtimeMinutes ?? null,
        directorNames: source.movie?.directorNames ?? null,
        actorNames: source.movie?.actorNames ?? null,
      };
    }

    if (source.kind === WorkKind.show) {
      return {
        firstAirDate: source.show?.firstAirDate ?? null,
        lastAirDate: source.show?.lastAirDate ?? null,
        creatorNames: source.show?.creatorNames ?? null,
        actorNames: source.show?.actorNames ?? null,
      };
    }

    if (source.kind === WorkKind.season) {
      return {
        seasonNumber: source.season?.seasonNumber ?? null,
        airDate: source.season?.airDate ?? null,
      };
    }

    if (source.kind === WorkKind.episode) {
      return {
        episodeNumber: source.episode?.episodeNumber ?? null,
        airDate: source.episode?.airDate ?? null,
        runtimeMinutes: source.episode?.runtimeMinutes ?? null,
        directorNames: source.episode?.directorNames ?? null,
        actorNames: source.episode?.actorNames ?? null,
      };
    }

    return {
      firstPublishYear: source.book?.firstPublishYear ?? null,
      authorNames: source.book?.authorNames ?? null,
    };
  }
}
