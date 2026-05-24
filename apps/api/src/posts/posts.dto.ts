import { z } from 'zod';

const reviewBodySchema = z
  .string()
  .trim()
  .min(1, 'Текст отзыва обязателен')
  .max(5000, 'Текст отзыва должен содержать не более 5000 символов');

export class CreateReviewDto {
  static readonly schema = z.object({
    body: reviewBodySchema,
  });

  body!: string;
}

export class UpdateReviewDto {
  static readonly schema = z.object({
    body: reviewBodySchema,
  });

  body!: string;
}
