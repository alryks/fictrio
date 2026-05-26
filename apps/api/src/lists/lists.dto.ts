import { z } from 'zod';

const listTitleSchema = z
  .string()
  .trim()
  .min(1, 'Название списка обязательно')
  .max(255, 'Название списка должно содержать не более 255 символов');

const listDescriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Описание списка должно содержать не более 2000 символов')
  .nullable()
  .optional();

export class GetListsQueryDto {
  static readonly schema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(12),
    offset: z.coerce.number().int().min(0).default(0),
  });

  limit!: number;
  offset!: number;
}

export class CreateListDto {
  static readonly schema = z.object({
    title: listTitleSchema,
    description: listDescriptionSchema,
    visibility: z.enum(['public', 'friends', 'private']).default('public'),
  });

  title!: string;
  description?: string | null;
  visibility!: 'public' | 'friends' | 'private';
}

export class UpdateListDto {
  static readonly schema = z
    .object({
      title: listTitleSchema.optional(),
      description: listDescriptionSchema,
    })
    .refine(
      (value) => value.title !== undefined || value.description !== undefined,
      {
        message: 'Передайте название или описание списка',
      },
    );

  title?: string;
  description?: string | null;
}

export class AddListItemDto {
  static readonly schema = z.object({
    workId: z.string().uuid('Некорректный идентификатор произведения'),
    position: z.coerce.number().int().min(0).optional(),
  });

  workId!: string;
  position?: number;
}

export class ReorderListItemsDto {
  static readonly schema = z.object({
    items: z
      .array(
        z.object({
          workId: z.string().uuid('Некорректный идентификатор произведения'),
          position: z.coerce.number().int().min(0),
        }),
      )
      .min(1, 'Передайте хотя бы один элемент списка'),
  });

  items!: Array<{ workId: string; position: number }>;
}
