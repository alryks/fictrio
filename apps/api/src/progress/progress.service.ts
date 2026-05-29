import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProgressStatus, WorkKind } from '@prisma/client';
import type {
  GetProgressQuery,
  ProgressListItem,
  ProgressPage,
  ProgressSummary,
  WorkListItem,
  WorkProgress,
} from '@fictrio/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertWorkProgressDto } from './progress.dto';

const workProgressInclude = Prisma.validator<Prisma.WorkInclude>()({
  movie: true,
  episode: true,
  book: true,
  show: {
    include: {
      seasons: {
        include: {
          episodes: {
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
        orderBy: {
          episodeNumber: 'asc',
        },
      },
    },
  },
});

type WorkForProgress = Prisma.WorkGetPayload<{
  include: typeof workProgressInclude;
}>;

type EpisodeProgressItem = {
  workId: string;
  runtimeMinutes: number | null;
  order: number;
};

type DirectProgressValues = {
  valueNow?: number;
  valueMax?: number;
};

type ProgressListRow = {
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
  progressStatus: ProgressStatus;
  valueNow: number | null;
  valueMax: number | null;
  updatedAt: Date;
  targetWorkId: string;
  completedItems: number | null;
  totalItems: number | null;
};

type CountRow = {
  count: bigint;
};

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkProgress(workId: string, userId: string): Promise<WorkProgress> {
    const work = await this.findWorkForProgress(workId);

    if (this.isContentWork(work.kind)) {
      return this.getContentProgress(work, userId);
    }

    return this.getGroupProgress(work, userId);
  }

  async upsertWorkProgress(
    workId: string,
    userId: string,
    dto: UpsertWorkProgressDto,
  ): Promise<WorkProgress> {
    const work = await this.findWorkForProgress(workId);

    if (this.isContentWork(work.kind)) {
      await this.upsertContentProgress(work, userId, dto.status, {
        valueNow: dto.valueNow,
        valueMax: dto.valueMax,
      });
      return this.getContentProgress(work, userId);
    }

    const episodes = this.collectEpisodes(work);
    if (episodes.length === 0) {
      throw new BadRequestException('У произведения нет эпизодов');
    }

    if (dto.status === ProgressStatus.started) {
      await this.startEpisodeIfMissing(episodes[0], userId);
    } else {
      await this.completeEpisodes(episodes, userId);
    }

    return this.getGroupProgress(work, userId);
  }

  async markWorkCompleted(workId: string, userId: string): Promise<void> {
    await this.upsertWorkProgress(workId, userId, {
      status: ProgressStatus.completed,
    });
  }

  async deleteWorkProgress(
    workId: string,
    userId: string,
  ): Promise<WorkProgress> {
    const work = await this.findWorkForProgress(workId);
    const contentWorkIds = this.isContentWork(work.kind)
      ? [work.id]
      : this.collectEpisodes(work).map((episode) => episode.workId);

    await this.prisma.progress.deleteMany({
      where: {
        userId,
        contentWorkId: {
          in: contentWorkIds,
        },
      },
    });

    if (this.isContentWork(work.kind)) {
      return this.getContentProgress(work, userId);
    }

    return this.getGroupProgress(work, userId);
  }

  async findUserProgressSummary(username: string): Promise<ProgressSummary> {
    const [started, completed] = await Promise.all([
      this.findUserProgress(username, {
        status: ProgressStatus.started,
        limit: 6,
        offset: 0,
      }),
      this.findUserProgress(username, {
        status: ProgressStatus.completed,
        limit: 6,
        offset: 0,
      }),
    ]);

    return {
      started: started.items,
      startedTotal: started.total,
      completed: completed.items,
      completedTotal: completed.total,
    };
  }

  async findUserProgress(
    username: string,
    query: GetProgressQuery,
  ): Promise<ProgressPage> {
    const user = await this.findActiveUser(username);
    const progressRowsSql = this.buildProgressRowsSql(user.id);

    const [rows, totalRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<ProgressListRow[]>`
        ${progressRowsSql}
        SELECT *
        FROM all_progress
        WHERE "progressStatus" = ${query.status}::progress_status
        ORDER BY "updatedAt" DESC NULLS LAST, title ASC
        LIMIT ${query.limit}
        OFFSET ${query.offset}
      `,
      this.prisma.$queryRaw<CountRow[]>`
        ${progressRowsSql}
        SELECT COUNT(*) AS count
        FROM all_progress
        WHERE "progressStatus" = ${query.status}::progress_status
      `,
    ]);

    return {
      items: rows.map((row) => this.toProgressListItem(row)),
      total: Number(totalRows[0]?.count ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  private async findWorkForProgress(workId: string): Promise<WorkForProgress> {
    const work = await this.prisma.work.findUnique({
      where: {
        id: workId,
      },
      include: workProgressInclude,
    });

    if (!work) {
      throw new NotFoundException('Произведение не найдено');
    }

    return work;
  }

  private async findActiveUser(username: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: username.trim().toLowerCase(),
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Пользователь не найден');
    }

    return user;
  }

  private async getContentProgress(
    work: WorkForProgress,
    userId: string,
  ): Promise<WorkProgress> {
    const progress = await this.prisma.progress.findUnique({
      where: {
        userId_contentWorkId: {
          userId,
          contentWorkId: work.id,
        },
      },
    });

    return {
      workId: work.id,
      status: progress?.status ?? null,
      valueNow: progress?.valueNow ?? null,
      valueMax: progress?.valueMax ?? null,
      updatedAt: progress?.updatedAt.toISOString() ?? null,
      targetWorkId: work.id,
      completedItems: null,
      totalItems: null,
    };
  }

  private async getGroupProgress(
    work: WorkForProgress,
    userId: string,
  ): Promise<WorkProgress> {
    const episodes = this.collectEpisodes(work);
    if (episodes.length === 0) {
      return {
        workId: work.id,
        status: null,
        valueNow: null,
        valueMax: null,
        updatedAt: null,
        targetWorkId: null,
        completedItems: 0,
        totalItems: 0,
      };
    }

    const progress = await this.prisma.progress.findMany({
      where: {
        userId,
        contentWorkId: {
          in: episodes.map((episode) => episode.workId),
        },
      },
    });
    const progressByWorkId = new Map(
      progress.map((item) => [item.contentWorkId, item]),
    );
    const completedItems = episodes.filter(
      (episode) =>
        progressByWorkId.get(episode.workId)?.status ===
        ProgressStatus.completed,
    ).length;
    const progressItems = episodes.filter((episode) =>
      progressByWorkId.has(episode.workId),
    ).length;
    const updatedAt = progress.reduce<Date | null>(
      (latest, item) =>
        latest === null || item.updatedAt > latest ? item.updatedAt : latest,
      null,
    );

    return {
      workId: work.id,
      status:
        completedItems === episodes.length
          ? ProgressStatus.completed
          : progressItems > 0
            ? ProgressStatus.started
            : null,
      valueNow: completedItems,
      valueMax: episodes.length,
      updatedAt: updatedAt?.toISOString() ?? null,
      targetWorkId: this.pickTargetEpisodeId(episodes, progressByWorkId),
      completedItems,
      totalItems: episodes.length,
    };
  }

  private async upsertContentProgress(
    work: WorkForProgress,
    userId: string,
    status: ProgressStatus,
    values: DirectProgressValues = {},
  ) {
    const existing = await this.prisma.progress.findUnique({
      where: {
        userId_contentWorkId: {
          userId,
          contentWorkId: work.id,
        },
      },
    });
    const defaultMax = this.defaultMaxForWork(work);
    const valueMax = values.valueMax ?? existing?.valueMax ?? defaultMax;
    const valueNow =
      status === ProgressStatus.completed
        ? valueMax
        : (values.valueNow ?? existing?.valueNow ?? 0);

    await this.prisma.content.upsert({
      where: {
        workId: work.id,
      },
      create: {
        workId: work.id,
      },
      update: {},
    });

    await this.prisma.progress.upsert({
      where: {
        userId_contentWorkId: {
          userId,
          contentWorkId: work.id,
        },
      },
      create: {
        userId,
        contentWorkId: work.id,
        status,
        valueNow,
        valueMax,
      },
      update: {
        status,
        valueNow,
        valueMax,
      },
    });
  }

  private async startEpisodeIfMissing(
    episode: EpisodeProgressItem,
    userId: string,
  ) {
    await this.prisma.content.upsert({
      where: {
        workId: episode.workId,
      },
      create: {
        workId: episode.workId,
      },
      update: {},
    });

    await this.prisma.progress.createMany({
      data: [
        {
          userId,
          contentWorkId: episode.workId,
          status: ProgressStatus.started,
          valueNow: 0,
          valueMax: episode.runtimeMinutes ?? 1,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async completeEpisodes(
    episodes: EpisodeProgressItem[],
    userId: string,
  ) {
    await this.prisma.content.createMany({
      data: episodes.map((episode) => ({
        workId: episode.workId,
      })),
      skipDuplicates: true,
    });

    await this.prisma.$transaction(
      episodes.map((episode) => {
        const valueMax = episode.runtimeMinutes ?? 1;
        return this.prisma.progress.upsert({
          where: {
            userId_contentWorkId: {
              userId,
              contentWorkId: episode.workId,
            },
          },
          create: {
            userId,
            contentWorkId: episode.workId,
            status: ProgressStatus.completed,
            valueNow: valueMax,
            valueMax,
          },
          update: {
            status: ProgressStatus.completed,
            valueNow: valueMax,
            valueMax,
          },
        });
      }),
    );
  }

  private collectEpisodes(work: WorkForProgress): EpisodeProgressItem[] {
    if (work.kind === WorkKind.show) {
      return (
        work.show?.seasons.flatMap((season) =>
          season.episodes.map((episode) => ({
            workId: episode.workId,
            runtimeMinutes: episode.runtimeMinutes,
            order: season.seasonNumber * 10000 + episode.episodeNumber,
          })),
        ) ?? []
      );
    }

    if (work.kind === WorkKind.season) {
      return (
        work.season?.episodes.map((episode) => ({
          workId: episode.workId,
          runtimeMinutes: episode.runtimeMinutes,
          order: episode.episodeNumber,
        })) ?? []
      );
    }

    return [];
  }

  private pickTargetEpisodeId(
    episodes: EpisodeProgressItem[],
    progressByWorkId: Map<string, { status: ProgressStatus }>,
  ): string | null {
    const ordered = episodes.toSorted(
      (left, right) => left.order - right.order,
    );
    const lastStarted = ordered.findLast(
      (episode) =>
        progressByWorkId.get(episode.workId)?.status === ProgressStatus.started,
    );

    if (lastStarted) {
      return lastStarted.workId;
    }

    const firstNotCompleted = ordered.find(
      (episode) =>
        progressByWorkId.get(episode.workId)?.status !==
        ProgressStatus.completed,
    );

    return firstNotCompleted?.workId ?? ordered[0]?.workId ?? null;
  }

  private isContentWork(kind: WorkKind) {
    return (
      kind === WorkKind.movie ||
      kind === WorkKind.episode ||
      kind === WorkKind.book
    );
  }

  private defaultMaxForWork(work: WorkForProgress): number {
    if (work.kind === WorkKind.movie) {
      return work.movie?.runtimeMinutes ?? 1;
    }

    if (work.kind === WorkKind.episode) {
      return work.episode?.runtimeMinutes ?? 1;
    }

    return 1;
  }

  private buildProgressRowsSql(userId: string) {
    return Prisma.sql`
      WITH direct_progress AS (
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
          NULL::date AS "firstAirDate",
          NULL::date AS "lastAirDate",
          NULL::text AS "creatorNames",
          NULL::text AS "showActorNames",
          b.first_publish_year AS "firstPublishYear",
          b.author_names AS "authorNames",
          p.status AS "progressStatus",
          p.value_now AS "valueNow",
          p.value_max AS "valueMax",
          p.updated_at AS "updatedAt",
          w.id AS "targetWorkId",
          NULL::integer AS "completedItems",
          NULL::integer AS "totalItems"
        FROM progress p
        JOIN works w ON w.id = p.content_work_id
        JOIN rateables rt ON rt.id = w.rateable_id
        LEFT JOIN ratings r ON r.rateable_id = rt.id
        LEFT JOIN movies m ON m.work_id = w.id
        LEFT JOIN books b ON b.work_id = w.id
        WHERE p.user_id = ${userId}::uuid
          AND w.kind IN ('movie', 'book')
        GROUP BY w.id, m.work_id, b.work_id, p.id
      ),
      show_progress AS (
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
          NULL::integer AS "runtimeMinutes",
          NULL::text AS "directorNames",
          NULL::text AS "movieActorNames",
          s.first_air_date AS "firstAirDate",
          s.last_air_date AS "lastAirDate",
          s.creator_names AS "creatorNames",
          s.actor_names AS "showActorNames",
          NULL::smallint AS "firstPublishYear",
          NULL::text AS "authorNames",
          CASE
            WHEN sp.completed_items = sp.total_items THEN 'completed'::progress_status
            WHEN sp.progress_items > 0 THEN 'started'::progress_status
            ELSE NULL
          END AS "progressStatus",
          sp.completed_items AS "valueNow",
          sp.total_items AS "valueMax",
          sp.updated_at AS "updatedAt",
          sp.target_work_id AS "targetWorkId",
          sp.completed_items AS "completedItems",
          sp.total_items AS "totalItems"
        FROM shows s
        JOIN works w ON w.id = s.work_id
        JOIN rateables rt ON rt.id = w.rateable_id
        LEFT JOIN ratings r ON r.rateable_id = rt.id
        JOIN LATERAL (
          SELECT
            COUNT(*)::integer AS total_items,
            COUNT(*) FILTER (WHERE p.status = 'completed')::integer AS completed_items,
            COUNT(p.id)::integer AS progress_items,
            MAX(p.updated_at) AS updated_at,
            COALESCE(
              (ARRAY_AGG(e.work_id ORDER BY seasons.season_number DESC, e.episode_number DESC) FILTER (WHERE p.status = 'started'))[1],
              (ARRAY_AGG(e.work_id ORDER BY seasons.season_number ASC, e.episode_number ASC) FILTER (WHERE p.status IS NULL OR p.status <> 'completed'))[1],
              (ARRAY_AGG(e.work_id ORDER BY seasons.season_number ASC, e.episode_number ASC))[1]
            ) AS target_work_id
          FROM seasons
          JOIN episodes e ON e.season_work_id = seasons.work_id
          LEFT JOIN progress p ON p.content_work_id = e.work_id
            AND p.user_id = ${userId}::uuid
          WHERE seasons.show_work_id = s.work_id
        ) sp ON true
        WHERE sp.total_items > 0
        GROUP BY w.id, s.work_id, sp.completed_items, sp.total_items, sp.progress_items, sp.updated_at, sp.target_work_id
      ),
      all_progress AS (
        SELECT *
        FROM direct_progress
        UNION ALL
        SELECT *
        FROM show_progress
        WHERE "progressStatus" IS NOT NULL
      )
    `;
  }

  private toProgressListItem(row: ProgressListRow): ProgressListItem {
    const work: WorkListItem = {
      id: row.id,
      kind: row.kind,
      title: row.title,
      originalTitle: row.originalTitle,
      description: row.description,
      releaseYear: row.releaseYear,
      imageUrl: row.imageUrl,
      rating: {
        average:
          row.averageRating === null
            ? null
            : Number(row.averageRating.toFixed(2)),
        count: Number(row.ratingCount),
      },
      meta: this.buildMeta(row),
    };

    return {
      work,
      targetWorkId: row.targetWorkId,
      progress: {
        workId: row.id,
        status: row.progressStatus,
        valueNow: row.valueNow,
        valueMax: row.valueMax,
        updatedAt: row.updatedAt.toISOString(),
        targetWorkId: row.targetWorkId,
        completedItems: row.completedItems,
        totalItems: row.totalItems,
      },
    };
  }

  private buildMeta(row: ProgressListRow): WorkListItem['meta'] {
    if (row.kind === WorkKind.movie) {
      return {
        runtimeMinutes: row.runtimeMinutes,
        directorNames: row.directorNames,
        actorNames: row.movieActorNames,
      };
    }

    if (row.kind === WorkKind.show) {
      return {
        firstAirDate: row.firstAirDate?.toISOString() ?? null,
        lastAirDate: row.lastAirDate?.toISOString() ?? null,
        creatorNames: row.creatorNames,
        actorNames: row.showActorNames,
      };
    }

    return {
      firstPublishYear: row.firstPublishYear,
      authorNames: row.authorNames,
    };
  }
}
