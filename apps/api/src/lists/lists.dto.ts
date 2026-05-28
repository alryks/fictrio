import {
  addListItemInputSchema,
  createListInputSchema,
  getListQuerySchema,
  getListsQuerySchema,
  reorderListItemsInputSchema,
  updateListInputSchema,
  type AddListItemInput,
  type CreateListInput,
  type GetListQuery,
  type GetListsQuery,
  type ListVisibility,
  type ListsSortBy,
  type ListsSortOrder,
  type ReorderListItemsInput,
  type UpdateListInput,
} from '@fictrio/contracts';

export class GetListsQueryDto implements GetListsQuery {
  static readonly schema = getListsQuerySchema;

  search?: string;
  minRating?: number;
  minRatingsCount?: number;
  sortBy!: ListsSortBy;
  sortOrder!: ListsSortOrder;
  limit!: number;
  offset!: number;
  itemsLimit!: number;
}

export class GetListQueryDto implements GetListQuery {
  static readonly schema = getListQuerySchema;

  itemsLimit!: number;
  itemsOffset!: number;
}

export class CreateListDto implements CreateListInput {
  static readonly schema = createListInputSchema;

  title!: string;
  description?: string | null;
  visibility!: ListVisibility;
}

export class UpdateListDto implements UpdateListInput {
  static readonly schema = updateListInputSchema;

  title?: string;
  description?: string | null;
}

export class AddListItemDto implements AddListItemInput {
  static readonly schema = addListItemInputSchema;

  workId!: string;
  position?: number;
}

export class ReorderListItemsDto implements ReorderListItemsInput {
  static readonly schema = reorderListItemsInputSchema;

  items!: Array<{ workId: string; position: number }>;
}
