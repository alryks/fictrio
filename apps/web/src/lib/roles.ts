import type { AuthUser } from "@/features/auth/use-session";

/** Role codes that may hide/restore user content. Mirrors the API. */
const MODERATION_ROLES = ["moderator", "admin"];

/**
 * Whether the signed-in user may moderate content (hide/restore reviews,
 * comments and lists). Both moderators and administrators qualify.
 */
export function isModerator(user: AuthUser | null): boolean {
  return Boolean(user?.roles.some((role) => MODERATION_ROLES.includes(role)));
}
