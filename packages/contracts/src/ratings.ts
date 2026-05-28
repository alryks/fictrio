import { z } from 'zod';
import { ratingStatsSchema, ratingValueSchema } from './common.js';

export const upsertRatingInputSchema = z.object({
  value: z.coerce.number().pipe(ratingValueSchema),
});
export type UpsertRatingInput = z.infer<typeof upsertRatingInputSchema>;

export const upsertRatingResponseSchema = z.object({
  id: z.string().uuid(),
  value: z.number().int(),
  rating: ratingStatsSchema,
});
export type UpsertRatingResponse = z.infer<typeof upsertRatingResponseSchema>;

export const deleteRatingResponseSchema = z.object({
  deleted: z.literal(true),
  rating: ratingStatsSchema,
});
export type DeleteRatingResponse = z.infer<typeof deleteRatingResponseSchema>;
