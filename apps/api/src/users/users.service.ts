import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PublicUser, PublicUserProfile } from '@fictrio/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyProfileDto } from './users.dto';

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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicProfile(username: string): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: {
        username: this.normalizeUsername(username),
      },
      include: userWithRolesInclude,
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Пользователь не найден');
    }

    return this.toPublicProfile(user);
  }

  async updateMe(userId: string, dto: UpdateMyProfileDto): Promise<PublicUser> {
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
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Пользователь с таким именем уже существует',
        );
      }

      throw error;
    }
  }

  private toPublicProfile(user: UserWithRoles): PublicUserProfile {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      roles: user.roles.map((userRole) => userRole.role.code),
    };
  }

  private toPrivateUser(user: UserWithRoles): PublicUser {
    return {
      ...this.toPublicProfile(user),
      email: user.email,
      isActive: user.isActive,
    };
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
