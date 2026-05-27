import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CSRF_COOKIE_NAME } from './cookies';

type RequestWithCsrf = {
  method: string;
  url?: string;
  cookies?: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard that enforces the double-submit cookie pattern for CSRF
 * protection. Every state-changing request (POST, PUT, PATCH, DELETE)
 * must carry an `x-csrf-token` header whose value matches the
 * `fictrio_csrf` cookie set by /auth/csrf.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithCsrf>();

    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = this.getHeader(request.headers['x-csrf-token']);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Недопустимый CSRF-токен');
    }

    return true;
  }

  private getHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
}
