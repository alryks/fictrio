import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from './auth.types';
import { ROLES_METADATA_KEY } from './roles.decorator';

type RequestWithUser = {
  user?: AuthenticatedUser;
};

/**
 * Authorizes the current user against the role codes declared with `@Roles`.
 * Runs after `JwtAuthGuard`, which has already verified the session and
 * attached `request.user`. With no `@Roles` metadata the route is open to any
 * authenticated user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const roles = request.user?.roles ?? [];

    if (!roles.some((role) => requiredRoles.includes(role))) {
      throw new ForbiddenException('Недостаточно прав для выполнения действия');
    }

    return true;
  }
}
