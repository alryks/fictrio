import { z } from 'zod';

const reviewBodySchema = z
  .string()
  .trim()
  .min(1, 'Текст отзыва обязателен')
  .max(5000, 'Текст отзыва должен содержать не более 5000 символов');

const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Текст комментария обязателен')
  .max(2000, 'Текст комментария должен содержать не более 2000 символов');

export class CreateReviewDto {
  static readonly schema = z.object({
    body: reviewBodySchema,
  });

  body!: string;
}

export class CreateCommentDto {
  static readonly schema = z.object({
    body: commentBodySchema,
  });

  body!: string;
}

export class UpdateCommentDto {
  static readonly schema = z.object({
    body: commentBodySchema,
  });

  body!: string;
}

export class GetPostsPageQueryDto {
  static readonly schema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  });

  limit!: number;
  offset!: number;
}

export class UpdateReviewDto {
  static readonly schema = z.object({
    body: reviewBodySchema,
  });

  body!: string;
}
