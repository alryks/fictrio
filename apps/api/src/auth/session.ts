import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import { SESSION_COOKIE_NAME } from './cookies';
import { getJwtSecret } from './jwt-config';
import { PrismaService } from '../prisma/prisma.service';

export type RequestWithSession = {
  cookies?: Record<string, string | undefined>;
  user?: AuthenticatedUser;
};

/**
 * Verifies the session cookie and, on success, attaches the authenticated
 * user to the request. Returns null when no valid session is present.
 * Shared by JwtAuthGuard (mandatory) and OptionalJwtAuthGuard.
 *
 * Identity comes from the signed JWT, but roles and the active flag are read
 * fresh from the database on every request. A role granted with
 * `db:grant-role` (or an account deactivated) therefore takes effect on the
 * next request, without forcing the user to sign in again to mint a token
 * carrying the new roles.
 */
export async function resolveSessionUser(
  request: RequestWithSession,
  jwtService: JwtService,
  configService: ConfigService,
  prisma: PrismaService,
): Promise<AuthenticatedUser | null> {
  const token = request.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  try {
    const payload = await jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: getJwtSecret(configService),
    });

    const found = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        isActive: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    });

    if (!found || !found.isActive) {
      return null;
    }

    const user: AuthenticatedUser = {
      id: found.id,
      username: found.username,
      roles: found.roles.map((userRole) => userRole.role.code),
    };
    request.user = user;
    return user;
  } catch {
    return null;
  }
}
