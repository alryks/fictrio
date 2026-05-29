import {
  getFeedQuerySchema,
  type FeedFilter,
  type GetFeedQuery,
} from '@fictrio/contracts';

export class GetFeedQueryDto implements GetFeedQuery {
  static readonly schema = getFeedQuerySchema;

  filter!: FeedFilter;
  limit!: number;
  offset!: number;
}
