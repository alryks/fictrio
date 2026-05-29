import { z } from "zod";
import { pageEnvelopeSchema, paginationSchema } from "./common.js";
import { progressStatusSchema } from "./enums.js";
import { workListItemSchema, workProgressSchema } from "./works.js";

const progressValueNowSchema = z.coerce
  .number()
  .int("Текущее значение должно быть целым числом")
  .min(0, "Текущее значение не может быть отрицательным");

const progressValueMaxSchema = z.coerce
  .number()
  .int("Максимальное значение должно быть целым числом")
  .min(1, "Максимальное значение должно быть положительным");

export const upsertWorkProgressInputSchema = z.object({
  status: progressStatusSchema,
  valueNow: progressValueNowSchema.optional(),
  valueMax: progressValueMaxSchema.optional(),
});
export type UpsertWorkProgressInput = z.infer<
  typeof upsertWorkProgressInputSchema
>;

export const progressListItemSchema = z.object({
  work: workListItemSchema,
  progress: workProgressSchema,
  targetWorkId: z.string().uuid(),
});
export type ProgressListItem = z.infer<typeof progressListItemSchema>;

export const getProgressQuerySchema = paginationSchema({
  limit: 24,
  maxLimit: 50,
}).extend({
  status: progressStatusSchema.default("started"),
});
export type GetProgressQuery = z.infer<typeof getProgressQuerySchema>;

export const progressPageSchema = pageEnvelopeSchema(progressListItemSchema);
export type ProgressPage = z.infer<typeof progressPageSchema>;

export const progressSummarySchema = z.object({
  started: z.array(progressListItemSchema),
  completed: z.array(progressListItemSchema),
});
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
