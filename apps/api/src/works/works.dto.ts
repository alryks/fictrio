import {
  getWorksQuerySchema,
  type SortOrder,
  type WorkKind,
  type WorksSortBy,
} from '@fictrio/contracts';

/**
 * DTO that describes the query string for `GET /works`. The class shape is
 * used by Nest as a metatype lookup target so the global ZodValidationPipe
 * can find the `schema` static and validate the request. Field declarations
 * mirror the post-transform shape of the schema for controller access.
 */
export class GetWorksQueryDto {
  static readonly schema = getWorksQuerySchema;

  search?: string;
  kind?: WorkKind;
  kinds?: WorkKind[];
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  minRatingsCount?: number;
  sortBy!: WorksSortBy;
  sortOrder!: SortOrder;
  limit!: number;
  offset!: number;
}
