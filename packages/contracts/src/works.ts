import { z } from "zod";
import {
  pageEnvelopeSchema,
  paginationSchema,
  ratingStatsSchema,
} from "./common.js";
import { workKindSchema } from "./enums.js";

const yearSchema = z.coerce.number().int().min(1800).max(2100);

const workKindArraySchema = z
  .preprocess((value) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string") {
      return value.split(",").filter(Boolean);
    }
    return value;
  }, z.array(workKindSchema))
  .optional();

const sortBySchema = z.enum([
  "title",
  "releaseYear",
  "averageRating",
  "ratingCount",
]);
export type WorksSortBy = z.infer<typeof sortBySchema>;

const sortOrderSchema = z.enum(["asc", "desc"]);
export type SortOrder = z.infer<typeof sortOrderSchema>;

export const getWorksQuerySchema = z
  .object({
    search: z.string().trim().max(255).optional(),
    kind: workKindSchema.optional(),
    kinds: workKindArraySchema,
    year: yearSchema.optional(),
    yearFrom: yearSchema.optional(),
    yearTo: yearSchema.optional(),
    minRating: z.coerce.number().min(0).max(3).optional(),
    minRatingsCount: z.coerce.number().int().min(0).optional(),
    sortBy: sortBySchema.default("releaseYear"),
    sortOrder: sortOrderSchema.default("desc"),
    limit: z.coerce.number().int().min(1).max(50).default(24),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .transform((query) => {
    const kinds = query.kinds ?? (query.kind ? [query.kind] : undefined);

    return {
      ...query,
      kinds,
      yearFrom: query.yearFrom ?? query.year,
      yearTo: query.yearTo ?? query.year,
    };
  })
  .refine(
    (query) =>
      query.yearFrom === undefined ||
      query.yearTo === undefined ||
      query.yearFrom <= query.yearTo,
    {
      message: "Начальный год не может быть больше конечного",
      path: ["yearFrom"],
    },
  );
export type GetWorksQuery = z.infer<typeof getWorksQuerySchema>;

const metaValueSchema = z.union([z.string(), z.number(), z.null()]);
export const workMetaSchema = z.record(z.string(), metaValueSchema);

export const workListItemSchema = z.object({
  id: z.string().uuid(),
  kind: workKindSchema,
  title: z.string(),
  originalTitle: z.string().nullable(),
  description: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  imageUrl: z.string().nullable(),
  rating: ratingStatsSchema,
  meta: workMetaSchema,
});
export type WorkListItem = z.infer<typeof workListItemSchema>;

const workSeasonItemSchema: z.ZodType<
  WorkListItem & { episodes: WorkListItem[] }
> = workListItemSchema.extend({
  episodes: z.array(workListItemSchema),
});

export const workDetailsSchema = workListItemSchema.extend({
  details: workMetaSchema.nullable(),
  userRating: z.number().nullable().optional(),
  seasons: z.array(workSeasonItemSchema).optional(),
  episodes: z.array(workListItemSchema).optional(),
});
export type WorkDetails = z.infer<typeof workDetailsSchema>;
export type WorkSeason = z.infer<typeof workSeasonItemSchema>;

export const worksPageSchema = pageEnvelopeSchema(workListItemSchema);
export type WorksPage = z.infer<typeof worksPageSchema>;

export const worksReviewsPaginationSchema = paginationSchema({
  limit: 10,
  maxLimit: 50,
});
