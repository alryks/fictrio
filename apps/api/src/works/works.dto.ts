import { WorkKind } from '@prisma/client';
import { z } from 'zod';

export class GetWorksQueryDto {
  static readonly schema = z.object({
    search: z.string().trim().max(255).optional(),
    kind: z.nativeEnum(WorkKind).optional(),
    year: z.coerce.number().int().min(1800).max(2100).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(24),
    offset: z.coerce.number().int().min(0).default(0),
  });

  search?: string;
  kind?: WorkKind;
  year?: number;
  limit!: number;
  offset!: number;
}
