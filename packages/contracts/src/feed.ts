import { z } from "zod";
import {
  isoDateTimeSchema,
  pageEnvelopeSchema,
  paginationSchema,
  publicUserRefSchema,
} from "./common.js";
import { fictrioListSchema } from "./lists.js";
import { workListItemSchema } from "./works.js";

/**
 * Activity feed filter:
 *   all   — ratings/reviews and lists;
 *   posts — only ratings and reviews;
 *   lists — only created lists.
 */
export const feedFilterSchema = z.enum(["all", "posts", "lists"]);
export type FeedFilter = z.infer<typeof feedFilterSchema>;

export const getFeedQuerySchema = paginationSchema({
  limit: 10,
  maxLimit: 30,
}).extend({
  filter: feedFilterSchema.default("all"),
});
export type GetFeedQuery = z.infer<typeof getFeedQuerySchema>;

/**
 * A rating or review by a user on a work. A bare rating (no review) has
 * `postKind: "rating"`, `reviewId: null` and an empty body; a review carries
 * its own post id so its comment thread can be loaded, exactly like on the
 * work page.
 */
export const feedPostActivitySchema = z.object({
  kind: z.literal("post"),
  id: z.string().uuid(),
  createdAt: isoDateTimeSchema,
  actor: publicUserRefSchema,
  postKind: z.enum(["review", "rating"]),
  reviewId: z.string().uuid().nullable(),
  body: z.string().nullable(),
  rating: z.number().int().nullable(),
  commentsCount: z.number().int().nonnegative(),
  work: workListItemSchema,
});
export type FeedPostActivity = z.infer<typeof feedPostActivitySchema>;

/** A list created by a user. */
export const feedListActivitySchema = z.object({
  kind: z.literal("list"),
  id: z.string().uuid(),
  createdAt: isoDateTimeSchema,
  actor: publicUserRefSchema,
  list: fictrioListSchema,
});
export type FeedListActivity = z.infer<typeof feedListActivitySchema>;

export const feedItemSchema = z.discriminatedUnion("kind", [
  feedPostActivitySchema,
  feedListActivitySchema,
]);
export type FeedItem = z.infer<typeof feedItemSchema>;

export const feedPageSchema = pageEnvelopeSchema(feedItemSchema);
export type FeedPage = z.infer<typeof feedPageSchema>;
