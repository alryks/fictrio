import type { AuthUser } from "@/features/auth/use-session";

/** Role codes that may hide/restore user content. Mirrors the API. */
const MODERATION_ROLES = ["moderator", "admin"];

/** Role codes that may manage works, accounts and roles. Mirrors the API. */
const ADMIN_ROLES = ["admin"];

/**
 * Whether the signed-in user may moderate content (hide/restore reviews,
 * comments and lists). Both moderators and administrators qualify.
 */
export function isModerator(user: AuthUser | null): boolean {
  return Boolean(user?.roles.some((role) => MODERATION_ROLES.includes(role)));
}

/**
 * Whether the signed-in user may administer the system (edit/delete works,
 * activate/deactivate accounts, manage roles). Only administrators qualify.
 */
export function isAdmin(user: AuthUser | null): boolean {
  return Boolean(user?.roles.some((role) => ADMIN_ROLES.includes(role)));
}
