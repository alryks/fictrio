import { z } from "zod";
import {
  isoDateTimeSchema,
  pageEnvelopeSchema,
  ratingStatsSchema,
} from "./common.js";
import { listVisibilitySchema } from "./enums.js";
import { workListItemSchema } from "./works.js";

const listTitleSchema = z
  .string()
  .trim()
  .min(1, "Название списка обязательно")
  .max(255, "Название списка должно содержать не более 255 символов");

const listDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Описание списка должно содержать не более 2000 символов")
  .nullable()
  .optional();

const listSortBySchema = z.enum([
  "averageRating",
  "ratingCount",
  "createdAt",
  "updatedAt",
]);
export type ListsSortBy = z.infer<typeof listSortBySchema>;

const sortOrderSchema = z.enum(["asc", "desc"]);
export type ListsSortOrder = z.infer<typeof sortOrderSchema>;

export const getListsQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  minRating: z.coerce.number().min(0).max(3).optional(),
  minRatingsCount: z.coerce.number().int().min(0).optional(),
  sortBy: listSortBySchema.default("updatedAt"),
  sortOrder: sortOrderSchema.default("desc"),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).default(0),
  itemsLimit: z.coerce.number().int().min(0).max(20).default(6),
});
export type GetListsQuery = z.infer<typeof getListsQuerySchema>;

export const getListQuerySchema = z.object({
  itemsLimit: z.coerce.number().int().min(1).max(50).default(12),
  itemsOffset: z.coerce.number().int().min(0).default(0),
});
export type GetListQuery = z.infer<typeof getListQuerySchema>;

export const createListInputSchema = z.object({
  title: listTitleSchema,
  description: listDescriptionSchema,
  visibility: listVisibilitySchema.default("public"),
});
export type CreateListInput = z.infer<typeof createListInputSchema>;

export const updateListInputSchema = z
  .object({
    title: listTitleSchema.optional(),
    description: listDescriptionSchema,
  })
  .refine(
    (value) => value.title !== undefined || value.description !== undefined,
    { message: "Передайте название или описание списка" },
  );
export type UpdateListInput = z.infer<typeof updateListInputSchema>;

export const addListItemInputSchema = z.object({
  workId: z.string().uuid("Некорректный идентификатор произведения"),
  position: z.coerce.number().int().min(0).optional(),
});
export type AddListItemInput = z.infer<typeof addListItemInputSchema>;

export const reorderListItemsInputSchema = z.object({
  items: z
    .array(
      z.object({
        workId: z.string().uuid("Некорректный идентификатор произведения"),
        position: z.coerce.number().int().min(0),
      }),
    )
    .min(1, "Передайте хотя бы один элемент списка"),
});
export type ReorderListItemsInput = z.infer<typeof reorderListItemsInputSchema>;

export const listOwnerSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
});
export type ListOwner = z.infer<typeof listOwnerSchema>;

export const listItemEntrySchema = z.object({
  position: z.number().int(),
  addedAt: isoDateTimeSchema,
  work: workListItemSchema,
});
export type ListItemEntry = z.infer<typeof listItemEntrySchema>;

export const fictrioListSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  visibility: listVisibilitySchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  owner: listOwnerSchema,
  rating: ratingStatsSchema,
  userRating: z.number().int().nullable(),
  itemsTotal: z.number().int().nonnegative(),
  items: z.array(listItemEntrySchema),
});
export type FictrioList = z.infer<typeof fictrioListSchema>;

export const listsPageSchema = pageEnvelopeSchema(fictrioListSchema).extend({
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ListsPage = z.infer<typeof listsPageSchema>;

export const myListsResponseSchema = z.object({
  items: z.array(fictrioListSchema),
  total: z.number().int().nonnegative(),
});
export type MyListsResponse = z.infer<typeof myListsResponseSchema>;
