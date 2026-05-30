import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListVisibility, Prisma, RateableKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from '../common/prisma-errors';
import {
  aggregateRateableRating,
  averageFromValues,
} from '../common/rating-stats';
import { listVisibleSql } from '../common/content-visibility';
import type { AuthenticatedUser } from '../auth/auth.types';
import { canModerate, isAdmin } from '../auth/roles';
import {
  AddListItemDto,
  CreateListDto,
  GetListQueryDto,
  GetListsQueryDto,
  ModerateListDto,
  ReorderListItemsDto,
  UpdateListDto,
} from './lists.dto';

function getListInclude(itemsLimit?: number, itemsOffset = 0) {
  return {
    owner: {
      select: {
        id: true,
        username: true,
        displayName: true,
        isActive: true,
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
        items: true,
      },
    },
    items: {
      include: {
        work: {
          include: {
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
        },
      },
      orderBy: {
        position: 'asc',
      },
      ...(itemsLimit === undefined
        ? {}
        : {
            take: itemsLimit,
            skip: itemsOffset,
          }),
    },
  } satisfies Prisma.ListInclude;
}

const listInclude = getListInclude();

const listPreviewInclude = getListInclude(6);

type ListWithDetails = Prisma.ListGetPayload<{ include: typeof listInclude }>;
type ListPreviewWorkRow = {
  id: string;
  kind: string;
  title: string;
  originalTitle: string | null;
  description: string | null;
  releaseYear: number | null;
  imageUrl: string | null;
  rating: {
    average: number | null;
    count: number;
  };
  meta: Record<string, never>;
};
type ListPreviewItemRow = {
  position: number;
  addedAt: string;
  work: ListPreviewWorkRow;
};
type PublicListRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: ListVisibility;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  averageRating: number | null;
  ratingCount: bigint;
  itemsTotal: number;
  items: ListPreviewItemRow[];
};
type CountRow = { count: bigint };

/**
 * Minimal viewer context for visibility checks: the user id (for ownership)
 * and role codes (for moderator access). `AuthenticatedUser` satisfies it,
 * and internal owner-scoped callers can pass just `{ id }`.
 */
type ListViewer = { id: string; roles?: string[] };

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: GetListsQueryDto, viewer?: ListViewer) {
    const whereSql = this.buildPublicListWhereSql(query, viewer);
    const havingSql = this.buildPublicListHavingSql(query);
    const pagedOrderSql = this.buildPublicListOrderSql(query, 'fl');
    const finalOrderSql = this.buildPublicListOrderSql(query, 'p');

    const [lists, totalRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<PublicListRow[]>`
        WITH filtered_lists AS (
          SELECT
            l.id,
            AVG(r.value)::float AS average_rating,
            COUNT(r.id)         AS rating_count
          FROM lists l
          JOIN rateables rt ON rt.id = l.rateable_id
          LEFT JOIN ratings r ON r.rateable_id = rt.id
          ${whereSql}
          GROUP BY l.id
          ${havingSql}
        ),
        paged_lists AS (
          SELECT fl.*
          FROM filtered_lists fl
          JOIN lists l ON l.id = fl.id
          ${pagedOrderSql}
          LIMIT ${query.limit}
          OFFSET ${query.offset}
        )
        SELECT
          l.id,
          l.title,
          l.description,
          l.visibility,
          l.is_hidden            AS "isHidden",
          l.created_at           AS "createdAt",
          l.updated_at           AS "updatedAt",
          u.id                   AS "ownerId",
          u.username             AS "ownerUsername",
          u.display_name         AS "ownerDisplayName",
          p.average_rating       AS "averageRating",
          p.rating_count         AS "ratingCount",
          (
            SELECT COUNT(*)::int
            FROM list_items li_total
            WHERE li_total.list_id = l.id
          ) AS "itemsTotal",
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'position', preview_items.position,
                  'addedAt', preview_items.added_at,
                  'work', jsonb_build_object(
                    'id', w.id,
                    'kind', w.kind,
                    'title', w.title,
                    'originalTitle', w.original_title,
                    'description', w.description,
                    'releaseYear', w.release_year,
                    'imageUrl', w.image_url,
                    'rating', jsonb_build_object(
                      'average', work_ratings.average_rating,
                      'count', work_ratings.rating_count
                    ),
                    'meta', '{}'::jsonb
                  )
                )
                ORDER BY preview_items.position
              )
              FROM (
                SELECT li.position, li.added_at, li.work_id
                FROM list_items li
                WHERE li.list_id = l.id
                ORDER BY li.position
                LIMIT ${query.itemsLimit}
              ) preview_items
              JOIN works w ON w.id = preview_items.work_id
              JOIN rateables wrt ON wrt.id = w.rateable_id
              LEFT JOIN LATERAL (
                SELECT
                  AVG(wr.value)::float AS average_rating,
                  COUNT(wr.id)::int    AS rating_count
                FROM ratings wr
                WHERE wr.rateable_id = wrt.id
              ) work_ratings ON true
            ),
            '[]'::jsonb
          ) AS items
        FROM paged_lists p
        JOIN lists l ON l.id = p.id
        JOIN users u ON u.id = l.owner_user_id
        ${finalOrderSql}
      `,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS count
        FROM (
          SELECT l.id
          FROM lists l
          JOIN rateables rt ON rt.id = l.rateable_id
          LEFT JOIN ratings r ON r.rateable_id = rt.id
          ${whereSql}
          GROUP BY l.id
          ${havingSql}
        ) filtered_lists
      `,
    ]);

    return {
      items: lists.map((list) => this.toPublicListRow(list)),
      total: Number(totalRows[0]?.count ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findMine(userId: string) {
    // The owner always sees their own lists, including hidden ones (rendered
    // with a moderation badge), so the hidden filter is intentionally absent.
    const lists = await this.prisma.list.findMany({
      where: {
        ownerUserId: userId,
      },
      include: listPreviewInclude,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return {
      items: lists.map((list) => this.toPublicList(list, userId)),
      total: lists.length,
    };
  }

  async findOne(id: string, viewer?: ListViewer, query?: GetListQueryDto) {
    const list = await this.prisma.list.findUnique({
      where: {
        id,
      },
      include: query
        ? getListInclude(query.itemsLimit, query.itemsOffset)
        : listInclude,
    });

    if (!list) {
      throw new NotFoundException('Список не найден');
    }

    const isOwner = list.ownerUserId === viewer?.id;
    const isPrivileged = isOwner || canModerate({ roles: viewer?.roles ?? [] });

    // A hidden list, or a non-public one, is only reachable by its owner or a
    // moderator (who needs to view it to moderate). Everyone else gets a 404.
    if (list.isHidden && !isPrivileged) {
      throw new NotFoundException('Список не найден');
    }

    if (list.visibility !== ListVisibility.public && !isPrivileged) {
      throw new NotFoundException('Список не найден');
    }

    // A list owned by a deactivated account is hidden from everyone but the
    // owner and administrators.
    if (
      !list.owner.isActive &&
      !isOwner &&
      !isAdmin({ roles: viewer?.roles ?? [] })
    ) {
      throw new NotFoundException('Список не найден');
    }

    return this.toPublicList(list, viewer?.id);
  }

  async create(userId: string, dto: CreateListDto) {
    const list = await this.prisma.list.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        visibility: dto.visibility,
        owner: {
          connect: {
            id: userId,
          },
        },
        rateable: {
          create: {
            kind: RateableKind.list,
          },
        },
      },
      include: listInclude,
    });

    return this.toPublicList(list, userId);
  }

  async updateList(listId: string, userId: string, dto: UpdateListDto) {
    await this.assertOwnedList(listId, userId);

    const list = await this.prisma.list.update({
      where: {
        id: listId,
      },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description || null }
          : {}),
      },
      include: listInclude,
    });

    return this.toPublicList(list, userId);
  }

  async addItem(listId: string, userId: string, dto: AddListItemDto) {
    await this.assertOwnedList(listId, userId);
    await this.assertWorkExists(dto.workId);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent additions to the same list so the
        // position computed below is still valid at insert time.
        await tx.$executeRaw`
          SELECT 1 FROM lists WHERE id = ${listId}::uuid FOR UPDATE
        `;

        const insertPosition = await this.getNextPositionTx(tx, listId);

        await tx.listItem.create({
          data: {
            listId,
            workId: dto.workId,
            position: insertPosition,
          },
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Произведение уже есть в списке');
      }

      throw error;
    }

    return this.findOne(listId, { id: userId });
  }

  private async getNextPositionTx(
    tx: Prisma.TransactionClient,
    listId: string,
  ) {
    const aggregate = await tx.listItem.aggregate({
      where: { listId },
      _max: { position: true },
    });
    return (aggregate._max.position ?? -1) + 1;
  }

  async removeItem(listId: string, workId: string, userId: string) {
    await this.assertOwnedList(listId, userId);

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.listItem.deleteMany({
        where: {
          listId,
          workId,
        },
      });

      if (deleted.count === 0) {
        throw new NotFoundException('Элемент списка не найден');
      }

      await this.compactItemPositions(tx, listId);
    });

    return this.findOne(listId, { id: userId });
  }

  async reorderItems(listId: string, userId: string, dto: ReorderListItemsDto) {
    await this.assertOwnedList(listId, userId);

    const existingItems = await this.prisma.listItem.findMany({
      where: {
        listId,
      },
      select: {
        workId: true,
      },
    });
    const existingWorkIds = new Set(existingItems.map((item) => item.workId));

    if (dto.items.some((item) => !existingWorkIds.has(item.workId))) {
      throw new NotFoundException('Элемент списка не найден');
    }

    // The (list_id, position) UNIQUE index is checked row-by-row, so a
    // direct UPDATE that swaps positions can violate uniqueness mid-statement.
    // Stash everything in disjoint negative positions, then assign the final
    // values in a second statement. Two bulk UPDATEs total instead of 2N.
    const stashTuples = Prisma.join(
      dto.items.map(
        (item, index) =>
          Prisma.sql`(${item.workId}::uuid, ${-(index + 1)}::int)`,
      ),
      ', ',
    );
    const finalTuples = Prisma.join(
      dto.items.map(
        (item) => Prisma.sql`(${item.workId}::uuid, ${item.position}::int)`,
      ),
      ', ',
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE list_items AS li
        SET position = data.new_position
        FROM (VALUES ${stashTuples}) AS data(work_id, new_position)
        WHERE li.list_id = ${listId}::uuid
          AND li.work_id = data.work_id
      `;
      await tx.$executeRaw`
        UPDATE list_items AS li
        SET position = data.new_position
        FROM (VALUES ${finalTuples}) AS data(work_id, new_position)
        WHERE li.list_id = ${listId}::uuid
          AND li.work_id = data.work_id
      `;
    });

    return this.findOne(listId, { id: userId });
  }

  private async compactItemPositions(
    tx: Prisma.TransactionClient,
    listId: string,
  ) {
    // Re-number positions from 0..N-1 in current order. Two bulk UPDATEs
    // (stash to disjoint negatives, then assign finals) avoid the same
    // mid-statement uniqueness violations as reorderItems.
    await tx.$executeRaw`
      WITH ordered AS (
        SELECT
          work_id,
          ROW_NUMBER() OVER (ORDER BY position ASC) AS row_number
        FROM list_items
        WHERE list_id = ${listId}::uuid
      )
      UPDATE list_items AS li
      SET position = -ordered.row_number::int
      FROM ordered
      WHERE li.list_id = ${listId}::uuid
        AND li.work_id = ordered.work_id
    `;
    await tx.$executeRaw`
      UPDATE list_items
      SET position = (-position - 1)
      WHERE list_id = ${listId}::uuid
        AND position < 0
    `;
  }

  async rateList(listId: string, userId: string, value: number) {
    const list = await this.prisma.list.findFirst({
      where: {
        id: listId,
        isHidden: false,
      },
      select: {
        rateableId: true,
        visibility: true,
        ownerUserId: true,
      },
    });

    if (
      !list ||
      (list.visibility !== ListVisibility.public && list.ownerUserId !== userId)
    ) {
      throw new NotFoundException('Список не найден');
    }

    const rating = await this.prisma.rating.upsert({
      where: {
        userId_rateableId: {
          userId,
          rateableId: list.rateableId,
        },
      },
      create: {
        userId,
        rateableId: list.rateableId,
        value,
      },
      update: {
        value,
      },
    });

    return {
      id: rating.id,
      value: rating.value,
      rating: await aggregateRateableRating(this.prisma, list.rateableId),
    };
  }

  async deleteListRating(listId: string, userId: string) {
    const list = await this.prisma.list.findFirst({
      where: {
        id: listId,
        isHidden: false,
      },
      select: {
        rateableId: true,
        visibility: true,
        ownerUserId: true,
      },
    });

    if (
      !list ||
      (list.visibility !== ListVisibility.public && list.ownerUserId !== userId)
    ) {
      throw new NotFoundException('Список не найден');
    }

    await this.prisma.rating.deleteMany({
      where: {
        userId,
        rateableId: list.rateableId,
      },
    });

    return {
      deleted: true,
      rating: await aggregateRateableRating(this.prisma, list.rateableId),
    };
  }

  async deleteList(listId: string, userId: string) {
    const list = await this.prisma.list.findUnique({
      where: {
        id: listId,
      },
      select: {
        ownerUserId: true,
        rateableId: true,
      },
    });

    if (!list) {
      throw new NotFoundException('Список не найден');
    }

    if (list.ownerUserId !== userId) {
      throw new ForbiddenException('Можно изменять только собственный список');
    }

    // List.rateable is onDelete: Restrict, so drop the list row first
    // (cascading items and moderation actions), then its rateable
    // (cascading ratings and posts) inside one transaction.
    await this.prisma.$transaction([
      this.prisma.list.delete({
        where: {
          id: listId,
        },
      }),
      this.prisma.rateable.delete({
        where: {
          id: list.rateableId,
        },
      }),
    ]);

    return {
      deleted: true,
    };
  }

  async moderateList(
    listId: string,
    moderator: AuthenticatedUser,
    dto: ModerateListDto,
  ) {
    const list = await this.prisma.list.findUnique({
      where: {
        id: listId,
      },
      select: {
        id: true,
      },
    });

    if (!list) {
      throw new NotFoundException('Список не найден');
    }

    // moderate_list hides/restores the list and logs the action atomically.
    await this.prisma.$executeRaw`
      CALL moderate_list(
        ${moderator.id}::uuid,
        ${listId}::uuid,
        ${dto.action}::moderation_action_kind,
        ${dto.reason ?? null}
      )
    `;

    return {
      id: listId,
      isHidden: dto.action === 'hide',
    };
  }

  private async assertOwnedList(listId: string, userId: string) {
    const list = await this.prisma.list.findUnique({
      where: {
        id: listId,
      },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!list) {
      throw new NotFoundException('Список не найден');
    }

    if (list.ownerUserId !== userId) {
      throw new ForbiddenException('Можно изменять только собственный список');
    }

    return list;
  }

  private async assertWorkExists(workId: string) {
    const work = await this.prisma.work.findUnique({
      where: {
        id: workId,
      },
      select: {
        id: true,
      },
    });

    if (!work) {
      throw new NotFoundException('Произведение не найдено');
    }
  }

  private toPublicList(list: ListWithDetails, viewerUserId?: string) {
    return {
      id: list.id,
      title: list.title,
      description: list.description,
      visibility: list.visibility,
      isHidden: list.isHidden,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      owner: {
        id: list.owner.id,
        username: list.owner.username,
        displayName: list.owner.displayName,
      },
      rating: averageFromValues(list.rateable.ratings),
      userRating:
        list.rateable.ratings.find((rating) => rating.userId === viewerUserId)
          ?.value ?? null,
      itemsTotal: list._count.items,
      items: list.items.map((item) => ({
        position: item.position,
        addedAt: item.addedAt,
        work: {
          id: item.work.id,
          kind: item.work.kind,
          title: item.work.title,
          originalTitle: item.work.originalTitle,
          description: item.work.description,
          releaseYear: item.work.releaseYear,
          imageUrl: item.work.imageUrl,
          rating: averageFromValues(item.work.rateable.ratings),
          meta: {},
        },
      })),
    };
  }

  private buildPublicListWhereSql(
    query: GetListsQueryDto,
    viewer?: ListViewer,
  ) {
    // Public, not hidden (unless privileged), and owned by an active account
    // (unless the viewer owns it or is an admin).
    const and: Prisma.Sql[] = [listVisibleSql('l', viewer)];

    if (query.search) {
      and.push(Prisma.sql`
        to_tsvector(
          'russian',
          coalesce(l.title, '') || ' ' || coalesce(l.description, '')
        ) @@ websearch_to_tsquery('russian', ${query.search})
      `);
    }

    return Prisma.sql`WHERE ${Prisma.join(and, ' AND ')}`;
  }

  private buildPublicListHavingSql(query: GetListsQueryDto) {
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

  private buildPublicListOrderSql(
    query: GetListsQueryDto,
    ratingAlias: 'fl' | 'p',
  ) {
    const direction =
      query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const ratings = Prisma.raw(ratingAlias);
    const list = Prisma.raw('l');

    if (query.sortBy === 'averageRating') {
      return Prisma.sql`ORDER BY ${ratings}.average_rating ${direction} NULLS LAST, ${list}.created_at DESC, ${list}.id`;
    }

    if (query.sortBy === 'ratingCount') {
      return Prisma.sql`ORDER BY ${ratings}.rating_count ${direction}, ${ratings}.average_rating DESC NULLS LAST, ${list}.created_at DESC, ${list}.id`;
    }

    if (query.sortBy === 'createdAt') {
      return Prisma.sql`ORDER BY ${list}.created_at ${direction}, ${list}.id`;
    }

    return Prisma.sql`ORDER BY ${list}.updated_at ${direction}, ${list}.id`;
  }

  private toPublicListRow(list: PublicListRow) {
    return {
      id: list.id,
      title: list.title,
      description: list.description,
      visibility: list.visibility,
      isHidden: list.isHidden,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      owner: {
        id: list.ownerId,
        username: list.ownerUsername,
        displayName: list.ownerDisplayName,
      },
      rating: {
        average:
          list.averageRating === null
            ? null
            : Number(list.averageRating.toFixed(2)),
        count: Number(list.ratingCount),
      },
      userRating: null,
      itemsTotal: list.itemsTotal,
      items: list.items.map((item) => ({
        position: item.position,
        addedAt: item.addedAt,
        work: {
          ...item.work,
          rating: {
            average:
              item.work.rating.average === null
                ? null
                : Number(item.work.rating.average.toFixed(2)),
            count: item.work.rating.count,
          },
        },
      })),
    };
  }
}
