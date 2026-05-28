import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, SelfUser } from '@fictrio/contracts';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { LoginDto, RegisterDto } from './auth.dto';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import {
  durationToSeconds,
  getJwtAccessTokenExpiresIn,
  getJwtSecret,
} from './jwt-config';

const DEFAULT_USER_ROLE_CODE = 'user';

/**
 * Result returned from sign-in/sign-up. The controller is responsible for
 * setting the access token as an HttpOnly cookie — the token never leaves
 * the server through the response body.
 */
export type AuthSession = {
  response: AuthResponse;
  accessToken: string;
  maxAgeSeconds: number;
};

type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: true;
      };
    };
  };
}>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const username = this.normalizeUsername(dto.username);
    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName?.trim() || username;
    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          displayName,
          roles: {
            create: {
              role: { connect: { code: DEFAULT_USER_ROLE_CODE } },
            },
          },
        },
        include: this.userWithRolesInclude(),
      });

      return this.toAuthSession(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Пользователь с таким именем или почтой уже существует',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const username = this.normalizeUsername(dto.username);
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: this.userWithRolesInclude(),
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Неверное имя пользователя или пароль');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Неверное имя пользователя или пароль');
    }

    return this.toAuthSession(user);
  }

  async getProfile(user: AuthenticatedUser): Promise<SelfUser> {
    const foundUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: this.userWithRolesInclude(),
    });

    if (!foundUser || !foundUser.isActive) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    return this.toSelfUser(foundUser);
  }

  private async toAuthSession(user: UserWithRoles): Promise<AuthSession> {
    const { token, maxAgeSeconds } = await this.signAccessToken(user);
    return {
      response: { user: this.toSelfUser(user) },
      accessToken: token,
      maxAgeSeconds,
    };
  }

  private async signAccessToken(
    user: UserWithRoles,
  ): Promise<{ token: string; maxAgeSeconds: number }> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      roles: user.roles.map((userRole) => userRole.role.code),
    };

    const expiresIn = getJwtAccessTokenExpiresIn(this.configService);
    const token = await this.jwtService.signAsync(payload, {
      secret: getJwtSecret(this.configService),
      expiresIn,
    });

    return { token, maxAgeSeconds: durationToSeconds(expiresIn) };
  }

  private toSelfUser(user: UserWithRoles): SelfUser {
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

  private userWithRolesInclude() {
    return {
      roles: {
        include: {
          role: true,
        },
      },
    } satisfies Prisma.UserInclude;
  }
}
