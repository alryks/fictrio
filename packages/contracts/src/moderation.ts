import { z } from "zod";
import { moderationActionKindSchema } from "./enums.js";

/**
 * Input for a moderation action over a post (review/comment) or a list.
 * `action` mirrors the database `moderation_action_kind` enum: `hide`
 * sets `is_hidden = true`, `restore` clears it. The optional `reason` is
 * stored in the moderation log.
 */
export const moderationInputSchema = z.object({
  action: moderationActionKindSchema,
  reason: z
    .string()
    .trim()
    .max(1000, "Причина должна содержать не более 1000 символов")
    .optional(),
});
export type ModerationInput = z.infer<typeof moderationInputSchema>;

/**
 * Result of a moderation action: the target's id and its new hidden state,
 * enough for the client to update or invalidate its cache.
 */
export const moderationResultSchema = z.object({
  id: z.string().uuid(),
  isHidden: z.boolean(),
});
export type ModerationResult = z.infer<typeof moderationResultSchema>;
