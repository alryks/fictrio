import { Prisma } from '@prisma/client';
import { canModerate, isAdmin } from '../auth/roles';

/**
 * Minimal viewer context for read-time visibility checks: the user id (for
 * ownership) and role codes (for moderator/admin access). `AuthenticatedUser`
 * and the lists module's `ListViewer` both satisfy it.
 */
export type VisibilityViewer = { id?: string; roles?: string[] };

function rolesOnly(viewer?: VisibilityViewer): { roles: string[] } {
  return { roles: viewer?.roles ?? [] };
}

/**
 * SQL predicate: the account identified by `authorIdSql` is active, OR the
 * viewer is that account, OR the viewer is an administrator.
 *
 * This is how a deactivated user's historical content (reviews, comments,
 * ratings, lists) is hidden from everyone else while staying visible to the
 * user themselves and to administrators — enforced at read time only, never
 * by mutating the stored rows.
 */
export function authorActiveSql(
  authorIdSql: Prisma.Sql,
  viewer?: VisibilityViewer,
): Prisma.Sql {
  const viewerId = viewer?.id ?? null;

  return Prisma.sql`(EXISTS (SELECT 1 FROM users vu WHERE vu.id = ${authorIdSql} AND vu.is_active) OR ${isAdmin(rolesOnly(viewer))} OR ${authorIdSql} = ${viewerId}::uuid)`;
}

/**
 * SQL predicate for a post (review/comment) at `alias` being visible: not
 * hidden by a moderator (unless the viewer may moderate or authored it) AND
 * its author is visible per {@link authorActiveSql}. `alias` is the post
 * relation alias in the surrounding query.
 */
export function postVisibleSql(
  alias: string,
  viewer?: VisibilityViewer,
): Prisma.Sql {
  const ref = Prisma.raw(alias);
  const authorId = Prisma.raw(`${alias}.author_user_id`);
  const viewerId = viewer?.id ?? null;

  return Prisma.sql`((${ref}.is_hidden = false OR ${canModerate(rolesOnly(viewer))} OR ${ref}.author_user_id = ${viewerId}::uuid) AND ${authorActiveSql(authorId, viewer)})`;
}

/**
 * SQL predicate for a list at `alias` being visible: it is public, not hidden
 * by a moderator (unless the viewer may moderate or owns it), and its owner is
 * visible per {@link authorActiveSql}.
 */
export function listVisibleSql(
  alias: string,
  viewer?: VisibilityViewer,
): Prisma.Sql {
  const ref = Prisma.raw(alias);
  const ownerId = Prisma.raw(`${alias}.owner_user_id`);
  const viewerId = viewer?.id ?? null;

  return Prisma.sql`(${ref}.visibility = 'public'::list_visibility AND (${ref}.is_hidden = false OR ${canModerate(rolesOnly(viewer))} OR ${ref}.owner_user_id = ${viewerId}::uuid) AND ${authorActiveSql(ownerId, viewer)})`;
}
