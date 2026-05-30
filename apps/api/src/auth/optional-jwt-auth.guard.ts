import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { resolveSessionUser, type RequestWithSession } from './session';

/**
 * Attaches the authenticated user to the request when a valid session
 * cookie is present, but never rejects the request. Used on endpoints
 * that are public yet behave differently for the owner (e.g. viewing a
 * private list you own).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    await resolveSessionUser(
      request,
      this.jwtService,
      this.configService,
      this.prisma,
    );
    return true;
  }
}
