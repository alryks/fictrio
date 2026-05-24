import { WorkKind } from '@prisma/client';
import { z } from 'zod';

const yearSchema = z.coerce.number().int().min(1800).max(2100);
const workKindArraySchema = z
  .preprocess(
    (value) => {
      if (Array.isArray(value)) {
        const items: unknown[] = value;
        return items;
      }

      if (typeof value === 'string') {
        return value.split(',').filter(Boolean);
      }

      return value;
    },
    z.array(z.nativeEnum(WorkKind)),
  )
  .optional();

const sortBySchema = z.enum(['title', 'releaseYear', 'averageRating']);
const sortOrderSchema = z.enum(['asc', 'desc']);

export class GetWorksQueryDto {
  static readonly schema = z
    .object({
      search: z.string().trim().max(255).optional(),
      kind: z.nativeEnum(WorkKind).optional(),
      kinds: workKindArraySchema,
      year: yearSchema.optional(),
      yearFrom: yearSchema.optional(),
      yearTo: yearSchema.optional(),
      minRating: z.coerce.number().min(0).max(3).optional(),
      sortBy: sortBySchema.default('releaseYear'),
      sortOrder: sortOrderSchema.default('desc'),
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
        message: 'Начальный год не может быть больше конечного',
        path: ['yearFrom'],
      },
    );

  search?: string;
  kinds?: WorkKind[];
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  sortBy!: 'title' | 'releaseYear' | 'averageRating';
  sortOrder!: 'asc' | 'desc';
  limit!: number;
  offset!: number;
}
