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
  GetListsQueryDto,
  ReorderListItemsDto,
  UpdateListDto,
} from './lists.dto';

const listInclude = {
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
  },
} satisfies Prisma.ListInclude;

type ListWithDetails = Prisma.ListGetPayload<{ include: typeof listInclude }>;

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
        include: listInclude,
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
      include: listInclude,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return {
      items: lists.map((list) => this.toPublicList(list, userId)),
      total: lists.length,
    };
  }

  async findOne(id: string, userId?: string) {
    const list = await this.prisma.list.findUnique({
      where: {
        id,
      },
      include: listInclude,
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

    const position = dto.position ?? (await this.getNextPosition(listId));

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.position !== undefined) {
          await tx.listItem.updateMany({
            where: {
              listId,
              position: {
                gte: dto.position,
              },
            },
            data: {
              position: {
                increment: 1,
              },
            },
          });
        }

        await tx.listItem.create({
          data: {
            listId,
            workId: dto.workId,
            position,
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

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        dto.items.map((item, index) =>
          tx.listItem.update({
            where: {
              listId_workId: {
                listId,
                workId: item.workId,
              },
            },
            data: {
              position: -(index + 1),
            },
          }),
        ),
      );

      await Promise.all(
        dto.items.map((item) =>
          tx.listItem.update({
            where: {
              listId_workId: {
                listId,
                workId: item.workId,
              },
            },
            data: {
              position: item.position,
            },
          }),
        ),
      );
    });

    return this.findOne(listId, userId);
  }

  private async compactItemPositions(
    tx: Prisma.TransactionClient,
    listId: string,
  ) {
    const items = await tx.listItem.findMany({
      where: {
        listId,
      },
      select: {
        workId: true,
      },
      orderBy: {
        position: 'asc',
      },
    });

    await Promise.all(
      items.map((item, index) =>
        tx.listItem.update({
          where: {
            listId_workId: {
              listId,
              workId: item.workId,
            },
          },
          data: {
            position: -(index + 1),
          },
        }),
      ),
    );

    await Promise.all(
      items.map((item, index) =>
        tx.listItem.update({
          where: {
            listId_workId: {
              listId,
              workId: item.workId,
            },
          },
          data: {
            position: index,
          },
        }),
      ),
    );
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

  private async getNextPosition(listId: string) {
    const aggregate = await this.prisma.listItem.aggregate({
      where: {
        listId,
      },
      _max: {
        position: true,
      },
    });

    return (aggregate._max.position ?? -1) + 1;
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

  private toPublicList(list: ListWithDetails, viewerUserId?: string) {
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
