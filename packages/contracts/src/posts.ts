import { z } from 'zod';
import {
  isoDateTimeSchema,
  pageEnvelopeSchema,
  paginationSchema,
  publicUserRefSchema,
} from './common.js';

const reviewBodySchema = z
  .string()
  .trim()
  .min(1, 'Текст отзыва обязателен')
  .max(5000, 'Текст отзыва должен содержать не более 5000 символов');

const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Текст комментария обязателен')
  .max(2000, 'Текст комментария должен содержать не более 2000 символов');

export const createReviewInputSchema = z.object({ body: reviewBodySchema });
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

export const updateReviewInputSchema = z.object({ body: reviewBodySchema });
export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;

export const createCommentInputSchema = z.object({ body: commentBodySchema });
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

export const updateCommentInputSchema = z.object({ body: commentBodySchema });
export type UpdateCommentInput = z.infer<typeof updateCommentInputSchema>;

export const getPostsPageQuerySchema = paginationSchema({
  limit: 10,
  maxLimit: 50,
});
export type GetPostsPageQuery = z.infer<typeof getPostsPageQuerySchema>;

export const reviewSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['review', 'rating']),
  body: z.string().nullable(),
  isHidden: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  author: publicUserRefSchema,
  rating: z.number().int().nullable(),
  commentsCount: z.number().int().nonnegative(),
});
export type Review = z.infer<typeof reviewSchema>;

export const reviewCommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  isHidden: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  author: publicUserRefSchema,
  rating: z.number().int().nullable(),
});
export type ReviewComment = z.infer<typeof reviewCommentSchema>;

export const reviewsPageSchema = pageEnvelopeSchema(reviewSchema);
export type ReviewsPage = z.infer<typeof reviewsPageSchema>;

export const reviewCommentsPageSchema = pageEnvelopeSchema(reviewCommentSchema);
export type ReviewCommentsPage = z.infer<typeof reviewCommentsPageSchema>;

export const deletedResponseSchema = z.object({ deleted: z.literal(true) });
export type DeletedResponse = z.infer<typeof deletedResponseSchema>;
