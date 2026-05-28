import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { resolveSessionUser, type RequestWithSession } from './session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const user = await resolveSessionUser(
      request,
      this.jwtService,
      this.configService,
    );

    if (!user) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    return true;
  }
}
