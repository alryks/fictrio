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

export class UpdateReviewDto {
  static readonly schema = z.object({
    body: reviewBodySchema,
  });

  body!: string;
}
