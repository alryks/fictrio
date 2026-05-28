import type {
  CreateListInput,
  DeletedResponse,
  FictrioList,
  ListOwner,
  ListsPage,
  MyListsResponse,
  RatingStats,
  UpdateListInput,
  UpsertRatingResponse,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type { FictrioList, ListOwner };
export type ListsResponse = ListsPage;

export function getPublicLists(offset = 0, limit = 12, itemsLimit = 6) {
  return apiRequest<ListsResponse>(
    `/lists?offset=${offset}&limit=${limit}&itemsLimit=${itemsLimit}`,
  );
}

export function getMyLists() {
  return apiRequest<MyListsResponse>("/lists/mine");
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
