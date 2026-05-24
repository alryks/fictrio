import { z } from 'zod';

export class UpsertRatingDto {
  static readonly schema = z.object({
    value: z.coerce
      .number()
      .int('Оценка должна быть целым числом')
      .min(0, 'Оценка не может быть меньше 0')
      .max(3, 'Оценка не может быть больше 3'),
  });

  value!: number;
}
