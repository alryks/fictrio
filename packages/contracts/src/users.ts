import { z } from "zod";
import {
  paginationSchema,
  pageEnvelopeSchema,
  publicUserRefSchema,
} from "./common.js";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Имя пользователя должно содержать не менее 3 символов")
  .max(64, "Имя пользователя должно содержать не более 64 символов")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчеркивания",
  );

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Отображаемое имя обязательно")
  .max(64, "Отображаемое имя должно содержать не более 64 символов");

const bioSchema = z
  .string()
  .trim()
  .max(1000, "Описание должно содержать не более 1000 символов")
  .nullable()
  .optional();

/**
 * Follow relationship summary attached to every public-facing user shape:
 * how many users follow them, how many they follow, and whether the current
 * viewer already follows them / is looking at their own record.
 */
export const followStatsSchema = z.object({
  followersCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  isFollowedByViewer: z.boolean(),
  isSelf: z.boolean(),
});
export type FollowStats = z.infer<typeof followStatsSchema>;

export const publicUserProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  isActive: z.boolean(),
  roles: z.array(z.string()),
  ...followStatsSchema.shape,
});
export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>;

/**
 * Compact user row used in search results and follower/following lists.
 * Reuses the embedded-author ref and adds the follow summary so each row can
 * render a follow/unfollow button without an extra request.
 */
export const userSummarySchema = publicUserRefSchema.extend({
  bio: z.string().nullable(),
  ...followStatsSchema.shape,
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const usersPageSchema = pageEnvelopeSchema(userSummarySchema);
export type UsersPage = z.infer<typeof usersPageSchema>;

export const getUsersQuerySchema = paginationSchema({
  limit: 20,
  maxLimit: 50,
}).extend({
  search: z.string().trim().max(64).optional(),
});
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;

export const getFollowListQuerySchema = getUsersQuerySchema;
export type GetFollowListQuery = z.infer<typeof getFollowListQuerySchema>;

/** Result of a follow/unfollow mutation: the target user's refreshed stats. */
export const followResponseSchema = followStatsSchema;
export type FollowResponse = z.infer<typeof followResponseSchema>;

export const updateMyProfileInputSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: displayNameSchema.optional(),
    bio: bioSchema,
  })
  .refine(
    (value) =>
      value.username !== undefined ||
      value.displayName !== undefined ||
      value.bio !== undefined,
    { message: "Передайте имя пользователя, отображаемое имя или описание" },
  );
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileInputSchema>;

/**
 * Administrator-managed roles. The base `user` role is assigned at
 * registration and is never granted or revoked through this API; mirrors the
 * `MANAGEABLE_ROLES` set on the server.
 */
export const manageableRoleSchema = z.enum(["moderator", "admin"]);
export type ManageableRole = z.infer<typeof manageableRoleSchema>;

/** Administrator toggle of an account's active flag. */
export const setUserActiveInputSchema = z.object({
  isActive: z.boolean(),
});
export type SetUserActiveInput = z.infer<typeof setUserActiveInputSchema>;
