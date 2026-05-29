import {
  getProgressQuerySchema,
  type GetProgressQuery,
  upsertWorkProgressInputSchema,
  type UpsertWorkProgressInput,
  type ProgressStatus,
} from '@fictrio/contracts';

export class UpsertWorkProgressDto implements UpsertWorkProgressInput {
  static readonly schema = upsertWorkProgressInputSchema;

  status!: ProgressStatus;
  valueNow?: number;
  valueMax?: number;
}

export class GetProgressQueryDto implements GetProgressQuery {
  static readonly schema = getProgressQuerySchema;

  status!: ProgressStatus;
  limit!: number;
  offset!: number;
}
