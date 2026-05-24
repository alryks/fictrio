import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';

const DEFAULT_USER_ROLE = {
  id: 1,
  code: 'user',
  name: 'Авторизованный пользователь',
};

type PublicUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string | null;
  isActive: boolean;
  roles: string[];
};

type AuthResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  user: PublicUser;
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

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const username = this.normalizeUsername(dto.username);
    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName?.trim() || username;
    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.upsert({
          where: { code: DEFAULT_USER_ROLE.code },
          create: DEFAULT_USER_ROLE,
          update: {
            name: DEFAULT_USER_ROLE.name,
          },
        });

        const createdUser = await tx.user.create({
          data: {
            username,
            email,
            passwordHash,
            displayName,
            roles: {
              create: {
                roleId: role.id,
              },
            },
          },
          include: this.userWithRolesInclude(),
        });

        return createdUser;
      });

      return this.toAuthResponse(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Пользователь с таким именем или почтой уже существует',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
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

    return this.toAuthResponse(user);
  }

  async getProfile(user: AuthenticatedUser): Promise<PublicUser> {
    const foundUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: this.userWithRolesInclude(),
    });

    if (!foundUser || !foundUser.isActive) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    return this.toPublicUser(foundUser);
  }

  private async toAuthResponse(user: UserWithRoles): Promise<AuthResponse> {
    return {
      accessToken: await this.signAccessToken(user),
      tokenType: 'Bearer',
      user: this.toPublicUser(user),
    };
  }

  private async signAccessToken(user: UserWithRoles): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      roles: user.roles.map((userRole) => userRole.role.code),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getJwtSecret(),
      expiresIn: this.getJwtExpiresIn(),
    });
  }

  private toPublicUser(user: UserWithRoles): PublicUser {
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

  private getJwtSecret(): string {
    return (
      this.configService.get<string>('JWT_SECRET') ??
      'fictrio-development-secret-change-me'
    );
  }

  private getJwtExpiresIn(): JwtSignOptions['expiresIn'] {
    return (
      (this.configService.get<string>(
        'JWT_ACCESS_TOKEN_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn']) ?? '1h'
    );
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

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
