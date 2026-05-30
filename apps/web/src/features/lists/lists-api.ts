import type {
  CreateListInput,
  DeletedResponse,
  FictrioList,
  ListOwner,
  ListsSortBy,
  ListsSortOrder,
  ListsPage,
  ModerationInput,
  ModerationResult,
  MyListsResponse,
  RatingStats,
  UpdateListInput,
  UpsertRatingResponse,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type { FictrioList, ListOwner, ListsSortBy, ListsSortOrder };
export type ListsResponse = ListsPage;
export type ModerationAction = ModerationInput["action"];

export type GetPublicListsParams = {
  search?: string;
  minRating?: string;
  minRatingsCount?: string;
  sortBy?: ListsSortBy;
  sortOrder?: ListsSortOrder;
  offset?: number;
  limit?: number;
  itemsLimit?: number;
};

export function getPublicLists(params: GetPublicListsParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set("search", params.search);
  }

  if (params.minRating) {
    searchParams.set("minRating", params.minRating);
  }

  if (params.minRatingsCount) {
    searchParams.set("minRatingsCount", params.minRatingsCount);
  }

  if (params.sortBy) {
    searchParams.set("sortBy", params.sortBy);
  }

  if (params.sortOrder) {
    searchParams.set("sortOrder", params.sortOrder);
  }

  searchParams.set("offset", String(params.offset ?? 0));
  searchParams.set("limit", String(params.limit ?? 12));
  searchParams.set("itemsLimit", String(params.itemsLimit ?? 6));

  return apiRequest<ListsResponse>(`/lists?${searchParams.toString()}`);
}

export function getMyLists() {
  return apiRequest<MyListsResponse>("/me/lists");
}

export function getList(id: string, itemsOffset = 0, itemsLimit = 12) {
  return apiRequest<FictrioList>(
    `/lists/${id}?itemsOffset=${itemsOffset}&itemsLimit=${itemsLimit}`,
  );
}

export function createList(input: CreateListInput) {
  return apiRequest<FictrioList>("/lists", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addWorkToList(listId: string, workId: string) {
  return apiRequest<FictrioList>(`/lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({ workId }),
  });
}

export function updateList(listId: string, input: UpdateListInput) {
  return apiRequest<FictrioList>(`/lists/${listId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function removeWorkFromList(listId: string, workId: string) {
  return apiRequest<FictrioList>(`/lists/${listId}/items/${workId}`, {
    method: "DELETE",
  });
}

export function reorderListItems(
  listId: string,
  items: Array<{ workId: string; position: number }>,
) {
  return apiRequest<FictrioList>(`/lists/${listId}/items/order`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}

export function rateList(listId: string, value: number) {
  return apiRequest<UpsertRatingResponse>(`/lists/${listId}/rating`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export function deleteListRating(listId: string) {
  return apiRequest<DeletedResponse & { rating: RatingStats }>(
    `/lists/${listId}/rating`,
    {
      method: "DELETE",
    },
  );
}

export function moderateList(listId: string, action: ModerationAction) {
  return apiRequest<ModerationResult>(`/lists/${listId}/moderation`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
