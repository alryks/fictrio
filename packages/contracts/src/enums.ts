import { z } from 'zod';

export const workKindSchema = z.enum([
  'movie',
  'show',
  'season',
  'episode',
  'book',
]);
export type WorkKind = z.infer<typeof workKindSchema>;

export const catalogWorkKindSchema = z.enum(['movie', 'show', 'book']);
export type CatalogWorkKind = z.infer<typeof catalogWorkKindSchema>;

export const listVisibilitySchema = z.enum(['public', 'friends', 'private']);
export type ListVisibility = z.infer<typeof listVisibilitySchema>;

export const rateableKindSchema = z.enum(['work', 'list']);
export type RateableKind = z.infer<typeof rateableKindSchema>;

export const progressStatusSchema = z.enum(['started', 'completed']);
export type ProgressStatus = z.infer<typeof progressStatusSchema>;

export const moderationActionKindSchema = z.enum(['hide', 'restore']);
export type ModerationActionKind = z.infer<typeof moderationActionKindSchema>;
