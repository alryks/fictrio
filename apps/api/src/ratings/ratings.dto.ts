import {
  upsertRatingInputSchema,
  type UpsertRatingInput,
} from '@fictrio/contracts';

export class UpsertRatingDto implements UpsertRatingInput {
  static readonly schema = upsertRatingInputSchema;

  value!: number;
}
