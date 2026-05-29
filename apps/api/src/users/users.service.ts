import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PublicUserProfile,
  SelfUser,
  UserSummary,
  UsersPage,
  FollowResponse,
} from '@fictrio/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from '../common/prisma-errors';
import {
  GetFollowListQueryDto,
  GetUsersQueryDto,
  UpdateMyProfileDto,
} from './users.dto';

const userWithRolesInclude = {
  roles: {
    include: {
      role: true,
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof userWithRolesInclude;
}>;

const followCountsInclude = {
  _count: {
    select: {
      followers: true,
      following: true,
    },
  },
} satisfies Prisma.UserInclude;

const profileInclude = {
  ...userWithRolesInclude,
  ...followCountsInclude,
} satisfies Prisma.UserInclude;

const userSummaryInclude = {
  ...followCountsInclude,
} satisfies Prisma.UserInclude;

type SummaryUser = Prisma.UserGetPayload<{
  include: typeof userSummaryInclude;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicProfile(
    username: string,
    viewerId?: string,
  ): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: {
        username: this.normalizeUsername(username),
      },
      include: profileInclude,
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Пользователь не найден');
    }

    const followedSet = await this.viewerFollowedSet([user.id], viewerId);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      roles: user.roles.map((userRole) => userRole.role.code),
      ...this.followStats(user, followedSet, viewerId),
    };
  }

  async searchUsers(
    query: GetUsersQueryDto,
    viewerId?: string,
  ): Promise<UsersPage> {
    const where = this.buildUserSearchWhere(query.search);

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userSummaryInclude,
        orderBy: [{ username: 'asc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    return this.toUsersPage(users, total, query, viewerId);
  }

  async getFollowers(
    username: string,
    query: GetFollowListQueryDto,
    viewerId?: string,
  ): Promise<UsersPage> {
    const target = await this.resolveActiveUser(username);
    const followerWhere = this.buildUserSearchWhere(query.search);
    const where = {
      followedUserId: target.id,
      follower: followerWhere,
    } satisfies Prisma.FollowWhereInput;

    const [follows, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where,
        include: { follower: { include: userSummaryInclude } },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.follow.count({ where }),
    ]);

    return this.toUsersPage(
      follows.map((follow) => follow.follower),
      total,
      query,
      viewerId,
    );
  }

  async getFollowing(
    username: string,
    query: GetFollowListQueryDto,
    viewerId?: string,
  ): Promise<UsersPage> {
    const target = await this.resolveActiveUser(username);
    const followedWhere = this.buildUserSearchWhere(query.search);
    const where = {
      followerUserId: target.id,
      followed: followedWhere,
    } satisfies Prisma.FollowWhereInput;

    const [follows, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where,
        include: { followed: { include: userSummaryInclude } },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.follow.count({ where }),
    ]);

    return this.toUsersPage(
      follows.map((follow) => follow.followed),
      total,
      query,
      viewerId,
    );
  }

  async follow(username: string, viewerId: string): Promise<FollowResponse> {
    const target = await this.resolveActiveUser(username);

    if (target.id === viewerId) {
      throw new BadRequestException('Нельзя подписаться на самого себя');
    }

    try {
      await this.prisma.follow.create({
        data: {
          followerUserId: viewerId,
          followedUserId: target.id,
        },
      });
    } catch (error) {
      // A repeated follow is a no-op, not an error.
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    return this.followStatsFor(target.id, viewerId);
  }

  async unfollow(username: string, viewerId: string): Promise<FollowResponse> {
    const target = await this.resolveActiveUser(username);

    await this.prisma.follow.deleteMany({
      where: {
        followerUserId: viewerId,
        followedUserId: target.id,
      },
    });

    return this.followStatsFor(target.id, viewerId);
  }

  async updateMe(userId: string, dto: UpdateMyProfileDto): Promise<SelfUser> {
    try {
      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          ...(dto.username !== undefined
            ? { username: this.normalizeUsername(dto.username) }
            : {}),
          ...(dto.displayName !== undefined
            ? { displayName: dto.displayName.trim() }
            : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio?.trim() || null } : {}),
        },
        include: userWithRolesInclude,
      });

      return this.toPrivateUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Пользователь с таким именем уже существует',
        );
      }

      throw error;
    }
  }

  private async resolveActiveUser(username: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: this.normalizeUsername(username),
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

  private async followStatsFor(
    targetId: string,
    viewerId?: string,
  ): Promise<FollowResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      include: userSummaryInclude,
    });
    const followedSet = await this.viewerFollowedSet([targetId], viewerId);

    return this.followStats(user, followedSet, viewerId);
  }

  private async toUsersPage(
    users: SummaryUser[],
    total: number,
    query: { limit: number; offset: number },
    viewerId?: string,
  ): Promise<UsersPage> {
    const followedSet = await this.viewerFollowedSet(
      users.map((user) => user.id),
      viewerId,
    );

    return {
      items: users.map((user) =>
        this.toUserSummary(user, followedSet, viewerId),
      ),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Of the given user ids, returns those the viewer already follows. A single
   * query keeps the per-row "isFollowedByViewer" flag off the N+1 path.
   */
  private async viewerFollowedSet(
    userIds: string[],
    viewerId?: string,
  ): Promise<Set<string>> {
    if (!viewerId || userIds.length === 0) {
      return new Set();
    }

    const follows = await this.prisma.follow.findMany({
      where: {
        followerUserId: viewerId,
        followedUserId: { in: userIds },
      },
      select: {
        followedUserId: true,
      },
    });

    return new Set(follows.map((follow) => follow.followedUserId));
  }

  private toUserSummary(
    user: SummaryUser,
    followedSet: Set<string>,
    viewerId?: string,
  ): UserSummary {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      ...this.followStats(user, followedSet, viewerId),
    };
  }

  private followStats(
    user: { id: string; _count: { followers: number; following: number } },
    followedSet: Set<string>,
    viewerId?: string,
  ) {
    return {
      followersCount: user._count.followers,
      followingCount: user._count.following,
      isFollowedByViewer: followedSet.has(user.id),
      isSelf: viewerId === user.id,
    };
  }

  private buildUserSearchWhere(search?: string): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private toPrivateUser(user: UserWithRoles): SelfUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      bio: user.bio,
      isActive: user.isActive,
      roles: user.roles.map((userRole) => userRole.role.code),
    };
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }
}
