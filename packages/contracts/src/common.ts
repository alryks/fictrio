import { z } from 'zod';

/**
 * Limits used as the minimum and maximum bounds for any rating value in the
 * system. The domain rating is an integer 0..3.
 */
export const RATING_MIN = 0;
export const RATING_MAX = 3;

export const ratingValueSchema = z
  .number()
  .int('Оценка должна быть целым числом')
  .min(RATING_MIN, `Оценка не может быть меньше ${RATING_MIN}`)
  .max(RATING_MAX, `Оценка не может быть больше ${RATING_MAX}`);

export const ratingStatsSchema = z.object({
  average: z.number().nullable(),
  count: z.number().int().nonnegative(),
});
export type RatingStats = z.infer<typeof ratingStatsSchema>;

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export function paginationSchema(defaults: {
  limit: number;
  maxLimit: number;
}) {
  return z.object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(defaults.maxLimit)
      .default(defaults.limit),
    offset: z.coerce.number().int().min(0).default(0),
  });
}

export function pageEnvelopeSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  });
}

export const publicUserRefSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
});
export type PublicUserRef = z.infer<typeof publicUserRefSchema>;
