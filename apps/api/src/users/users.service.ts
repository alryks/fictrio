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
import type { AuthenticatedUser } from '../auth/auth.types';
import { isAdmin, MANAGEABLE_ROLES, ROLE_ADMIN } from '../auth/roles';
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

// Deactivated accounts behave like guests, so they are excluded from the
// follower/following counts (the follower/following lists already filter them
// out via buildUserSearchWhere). A follow by — or of — a deactivated account
// therefore does not inflate anyone's counts.
const followCountsInclude = {
  _count: {
    select: {
      followers: { where: { follower: { isActive: true } } },
      following: { where: { followed: { isActive: true } } },
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
    viewer?: AuthenticatedUser,
  ): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: {
        username: this.normalizeUsername(username),
      },
      include: profileInclude,
    });

    // A deactivated account is hidden from everyone except its owner and an
    // administrator, both of whom need to reach it (to view / reactivate it).
    const privileged = viewer?.id === user?.id || isAdmin(viewer);

    if (!user || (!user.isActive && !privileged)) {
      throw new NotFoundException('Пользователь не найден');
    }

    const followedSet = await this.viewerFollowedSet([user.id], viewer?.id);

    return this.toPublicProfile(user, followedSet, viewer?.id);
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

  async setUserActive(
    username: string,
    isActive: boolean,
    admin: AuthenticatedUser,
  ): Promise<PublicUserProfile> {
    const target = await this.resolveUser(username);

    // An administrator must not lock themselves out of the system.
    if (target.id === admin.id && !isActive) {
      throw new BadRequestException(
        'Нельзя деактивировать собственную учетную запись',
      );
    }

    await this.prisma.user.update({
      where: { id: target.id },
      data: { isActive },
    });

    return this.loadProfile(target.id, admin);
  }

  async assignRole(
    username: string,
    roleCode: string,
    admin: AuthenticatedUser,
  ): Promise<PublicUserProfile> {
    const role = await this.resolveManageableRole(roleCode);
    const target = await this.resolveUser(username);

    // Idempotent: re-granting an existing role is a no-op.
    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: target.id, roleId: role.id },
      },
      create: { userId: target.id, roleId: role.id },
      update: {},
    });

    return this.loadProfile(target.id, admin);
  }

  async removeRole(
    username: string,
    roleCode: string,
    admin: AuthenticatedUser,
  ): Promise<PublicUserProfile> {
    const role = await this.resolveManageableRole(roleCode);
    const target = await this.resolveUser(username);

    // An administrator must not strip their own admin role and lose access.
    if (target.id === admin.id && roleCode === ROLE_ADMIN) {
      throw new BadRequestException(
        'Нельзя снять роль администратора с самого себя',
      );
    }

    await this.prisma.userRole.deleteMany({
      where: { userId: target.id, roleId: role.id },
    });

    return this.loadProfile(target.id, admin);
  }

  private async resolveManageableRole(roleCode: string) {
    if (!(MANAGEABLE_ROLES as readonly string[]).includes(roleCode)) {
      throw new BadRequestException('Недопустимая роль');
    }

    return this.findRoleOrThrow(roleCode);
  }

  private async findRoleOrThrow(roleCode: string) {
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundException('Роль не найдена');
    }

    return role;
  }

  private async loadProfile(
    userId: string,
    viewer: AuthenticatedUser,
  ): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: profileInclude,
    });
    const followedSet = await this.viewerFollowedSet([user.id], viewer.id);

    return this.toPublicProfile(user, followedSet, viewer.id);
  }

  private toPublicProfile(
    user: Prisma.UserGetPayload<{ include: typeof profileInclude }>,
    followedSet: Set<string>,
    viewerId?: string,
  ): PublicUserProfile {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      isActive: user.isActive,
      roles: user.roles.map((userRole) => userRole.role.code),
      ...this.followStats(user, followedSet, viewerId),
    };
  }

  /** Resolves a user by username regardless of active state (admin scope). */
  private async resolveUser(username: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: this.normalizeUsername(username),
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return user;
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
