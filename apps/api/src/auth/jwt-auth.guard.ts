import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import { SESSION_COOKIE_NAME } from './cookies';
import { getJwtSecret } from './jwt-config';

type RequestWithSession = {
  cookies?: Record<string, string | undefined>;
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: getJwtSecret(this.configService),
        },
      );

      request.user = {
        id: payload.sub,
        username: payload.username,
        roles: payload.roles,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Требуется авторизация');
    }
  }
}
