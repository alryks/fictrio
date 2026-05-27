import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListVisibility, Prisma, RateableKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddListItemDto,
  CreateListDto,
  GetListQueryDto,
  GetListsQueryDto,
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
type PublicListPayload = ListWithDetails;

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: GetListsQueryDto) {
    const where = {
      visibility: ListVisibility.public,
      isHidden: false,
    } satisfies Prisma.ListWhereInput;

    const [lists, total] = await this.prisma.$transaction([
      this.prisma.list.findMany({
        where,
        include: getListInclude(query.itemsLimit),
        orderBy: {
          createdAt: 'desc',
        },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.list.count({ where }),
    ]);

    return {
      items: lists.map((list) => this.toPublicList(list)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findMine(userId: string) {
    const lists = await this.prisma.list.findMany({
      where: {
        ownerUserId: userId,
        isHidden: false,
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

  async findOne(id: string, userId?: string, query?: GetListQueryDto) {
    const list = await this.prisma.list.findUnique({
      where: {
        id,
      },
      include: query
        ? getListInclude(query.itemsLimit, query.itemsOffset)
        : listInclude,
    });

    if (!list || list.isHidden) {
      throw new NotFoundException('Список не найден');
    }

    if (
      list.visibility !== ListVisibility.public &&
      list.ownerUserId !== userId
    ) {
      throw new NotFoundException('Список не найден');
    }

    return this.toPublicList(list, userId);
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

        const insertPosition =
          dto.position ?? (await this.getNextPositionTx(tx, listId));

        if (dto.position !== undefined) {
          // The (list_id, position) UNIQUE index is checked row-by-row
          // so a direct `position = position + 1` would collide with the
          // neighbouring row mid-statement. Stash affected positions in
          // disjoint negatives, then restore as `position + 1`.
          await tx.$executeRaw`
            UPDATE list_items
            SET position = -position - 1
            WHERE list_id = ${listId}::uuid
              AND position >= ${dto.position}::int
          `;
          await tx.$executeRaw`
            UPDATE list_items
            SET position = -position
            WHERE list_id = ${listId}::uuid
              AND position < 0
          `;
        }

        await tx.listItem.create({
          data: {
            listId,
            workId: dto.workId,
            position: insertPosition,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Произведение уже есть в списке');
      }

      throw error;
    }

    return this.findOne(listId, userId);
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

    return this.findOne(listId, userId);
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

    return this.findOne(listId, userId);
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
      rating: await this.getRatingStats(list.rateableId),
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
      rating: await this.getRatingStats(list.rateableId),
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
        isHidden: true,
      },
    });

    if (!list || list.isHidden) {
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

  private async getRatingStats(rateableId: string) {
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

  private toPublicList(list: PublicListPayload, viewerUserId?: string) {
    return {
      id: list.id,
      title: list.title,
      description: list.description,
      visibility: list.visibility,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      owner: list.owner,
      rating: this.getInlineRatingStats(list.rateable.ratings),
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
          rating: this.getInlineRatingStats(item.work.rateable.ratings),
          meta: {},
        },
      })),
    };
  }

  private getInlineRatingStats(ratings: Array<{ value: number }>) {
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

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
