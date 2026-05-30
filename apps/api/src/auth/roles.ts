import type { AuthenticatedUser } from './auth.types';

/** Role codes seeded in the `roles` table (see seed_default_roles migration). */
export const ROLE_USER = 'user';
export const ROLE_MODERATOR = 'moderator';
export const ROLE_ADMIN = 'admin';

/** Roles allowed to hide/restore user content. */
export const MODERATION_ROLES = [ROLE_MODERATOR, ROLE_ADMIN] as const;

/** Roles allowed to manage works, accounts and role assignments. */
export const ADMIN_ROLES = [ROLE_ADMIN] as const;

/** Roles an administrator may grant or revoke. The base `user` role is fixed. */
export const MANAGEABLE_ROLES = [ROLE_MODERATOR, ROLE_ADMIN] as const;

/**
 * Whether the user may moderate content (hide/restore posts and lists).
 * Both moderators and administrators qualify; an absent user never does.
 */
export function canModerate(user?: Pick<AuthenticatedUser, 'roles'>): boolean {
  return Boolean(
    user?.roles.some((role) =>
      (MODERATION_ROLES as readonly string[]).includes(role),
    ),
  );
}

/**
 * Whether the user may administer the system (manage works, accounts and
 * roles). Only administrators qualify; an absent user never does.
 */
export function isAdmin(user?: Pick<AuthenticatedUser, 'roles'>): boolean {
  return Boolean(
    user?.roles.some((role) =>
      (ADMIN_ROLES as readonly string[]).includes(role),
    ),
  );
}
