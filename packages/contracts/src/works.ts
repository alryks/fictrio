import { z } from "zod";
import {
  pageEnvelopeSchema,
  paginationSchema,
  ratingStatsSchema,
} from "./common.js";
import { progressStatusSchema, workKindSchema } from "./enums.js";

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
    kinds: workKindArraySchema,
    yearFrom: yearSchema.optional(),
    yearTo: yearSchema.optional(),
    minRating: z.coerce.number().min(0).max(3).optional(),
    minRatingsCount: z.coerce.number().int().min(0).optional(),
    sortBy: sortBySchema.default("releaseYear"),
    sortOrder: sortOrderSchema.default("desc"),
    limit: z.coerce.number().int().min(1).max(50).default(24),
    offset: z.coerce.number().int().min(0).default(0),
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

export const workProgressSchema = z.object({
  workId: z.string().uuid(),
  status: progressStatusSchema.nullable(),
  valueNow: z.number().int().nonnegative().nullable(),
  valueMax: z.number().int().positive().nullable(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
  targetWorkId: z.string().uuid().nullable(),
  completedItems: z.number().int().nonnegative().nullable(),
  totalItems: z.number().int().nonnegative().nullable(),
});
export type WorkProgress = z.infer<typeof workProgressSchema>;

const workSeasonItemSchema: z.ZodType<
  WorkListItem & { episodes: WorkListItem[] }
> = workListItemSchema.extend({
  episodes: z.array(workListItemSchema),
});

export const workDetailsSchema = workListItemSchema.extend({
  details: workMetaSchema.nullable(),
  userRating: z.number().nullable().optional(),
  userProgress: workProgressSchema.nullable().optional(),
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

const workTitleSchema = z
  .string()
  .trim()
  .min(1, "Название произведения обязательно")
  .max(255, "Название произведения должно содержать не более 255 символов");

const workOriginalTitleSchema = z
  .string()
  .trim()
  .max(255, "Оригинальное название должно содержать не более 255 символов")
  .nullable()
  .optional();

const workDescriptionSchema = z
  .string()
  .trim()
  .max(5000, "Описание должно содержать не более 5000 символов")
  .nullable()
  .optional();

/**
 * Administrator edit of a work card. Every field is optional, but at least
 * one must be present; `originalTitle` and `description` accept `null` to
 * clear them.
 */
export const updateWorkInputSchema = z
  .object({
    title: workTitleSchema.optional(),
    originalTitle: workOriginalTitleSchema,
    description: workDescriptionSchema,
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.originalTitle !== undefined ||
      value.description !== undefined,
    {
      message: "Передайте название, оригинальное название или описание",
    },
  );
export type UpdateWorkInput = z.infer<typeof updateWorkInputSchema>;
