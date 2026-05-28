import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import { SESSION_COOKIE_NAME } from './cookies';
import { getJwtSecret } from './jwt-config';

export type RequestWithSession = {
  cookies?: Record<string, string | undefined>;
  user?: AuthenticatedUser;
};

/**
 * Verifies the session cookie and, on success, attaches the authenticated
 * user to the request. Returns null when no valid session is present.
 * Shared by JwtAuthGuard (mandatory) and OptionalJwtAuthGuard.
 */
export async function resolveSessionUser(
  request: RequestWithSession,
  jwtService: JwtService,
  configService: ConfigService,
): Promise<AuthenticatedUser | null> {
  const token = request.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  try {
    const payload = await jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: getJwtSecret(configService),
    });

    const user: AuthenticatedUser = {
      id: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
    request.user = user;
    return user;
  } catch {
    return null;
  }
}
