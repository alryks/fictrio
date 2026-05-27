import type { CookieSerializeOptions } from '@fastify/cookie';

export const SESSION_COOKIE_NAME = 'fictrio_session';
export const CSRF_COOKIE_NAME = 'fictrio_csrf';

const ONE_HOUR_SECONDS = 60 * 60;

function isProductionMode(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function sessionCookieOptions(
  maxAgeSeconds?: number,
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: isProductionMode(),
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds ?? ONE_HOUR_SECONDS,
  };
}

/**
 * CSRF cookie is intentionally not HttpOnly so client-side JavaScript can
 * read it and mirror its value in the `x-csrf-token` request header for the
 * double-submit cookie pattern.
 */
export function csrfCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: false,
    secure: isProductionMode(),
    sameSite: 'lax',
    path: '/',
  };
}

export function clearSessionCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: isProductionMode(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
}
