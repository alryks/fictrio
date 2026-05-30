import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { resolveSessionUser, type RequestWithSession } from './session';
import { SESSION_COOKIE_NAME } from './cookies';
import { PrismaService } from '../prisma/prisma.service';

describe('resolveSessionUser', () => {
  const secret = 'test-secret-test-secret-test-secret';
  const configService = {
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService;

  function createJwtService() {
    return new JwtService();
  }

  function createPrisma(
    user: {
      id: string;
      username: string;
      isActive: boolean;
      roles: Array<{ role: { code: string } }>;
    } | null,
  ) {
    return {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
    } as unknown as PrismaService;
  }

  async function sign(jwtService: JwtService, sub: string) {
    return jwtService.signAsync(
      { sub, username: 'stale', roles: ['stale'] },
      { secret },
    );
  }

  it('returns null when the session cookie is missing', async () => {
    const jwtService = createJwtService();
    const prisma = createPrisma(null);
    const request: RequestWithSession = { cookies: {} };

    const user = await resolveSessionUser(
      request,
      jwtService,
      configService,
      prisma,
    );

    expect(user).toBeNull();
  });

  it('resolves identity from the token but roles fresh from the database', async () => {
    const jwtService = createJwtService();
    const prisma = createPrisma({
      id: 'user-1',
      username: 'fan',
      isActive: true,
      roles: [{ role: { code: 'user' } }, { role: { code: 'moderator' } }],
    });
    const token = await sign(jwtService, 'user-1');
    const request: RequestWithSession = {
      cookies: { [SESSION_COOKIE_NAME]: token },
    };

    const user = await resolveSessionUser(
      request,
      jwtService,
      configService,
      prisma,
    );

    // Roles come from the DB row, not the (potentially stale) token payload.
    expect(user).toEqual({
      id: 'user-1',
      username: 'fan',
      isActive: true,
      roles: ['user', 'moderator'],
    });
    expect(request.user).toEqual(user);
  });

  it('resolves a deactivated account, carrying isActive: false', async () => {
    const jwtService = createJwtService();
    const prisma = createPrisma({
      id: 'user-1',
      username: 'fan',
      isActive: false,
      roles: [{ role: { code: 'user' } }],
    });
    const token = await sign(jwtService, 'user-1');
    const request: RequestWithSession = {
      cookies: { [SESSION_COOKIE_NAME]: token },
    };

    const user = await resolveSessionUser(
      request,
      jwtService,
      configService,
      prisma,
    );

    // The user is still resolved (so it can read its own profile); the
    // deactivated flag rides along for the guards to act on.
    expect(user).toEqual({
      id: 'user-1',
      username: 'fan',
      isActive: false,
      roles: ['user'],
    });
  });

  it('returns null when the user no longer exists', async () => {
    const jwtService = createJwtService();
    const prisma = createPrisma(null);
    const token = await sign(jwtService, 'ghost');
    const request: RequestWithSession = {
      cookies: { [SESSION_COOKIE_NAME]: token },
    };

    const user = await resolveSessionUser(
      request,
      jwtService,
      configService,
      prisma,
    );

    expect(user).toBeNull();
  });
});
