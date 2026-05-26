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

export function getMyLists(token: string) {
  return apiRequest<MyListsResponse>("/lists/mine", { token });
}

export function getList(id: string, itemsOffset = 0, itemsLimit = 12) {
  return apiRequest<FictrioList>(
    `/lists/${id}?itemsOffset=${itemsOffset}&itemsLimit=${itemsLimit}`,
  );
}

export function createList(input: CreateListInput, token: string) {
  return apiRequest<FictrioList>("/lists", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function addWorkToList(listId: string, workId: string, token: string) {
  return apiRequest<FictrioList>(`/lists/${listId}/items`, {
    method: "POST",
    token,
    body: JSON.stringify({ workId }),
  });
}

export function updateList(
  listId: string,
  input: UpdateListInput,
  token: string,
) {
  return apiRequest<FictrioList>(`/lists/${listId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export function removeWorkFromList(
  listId: string,
  workId: string,
  token: string,
) {
  return apiRequest<FictrioList>(`/lists/${listId}/items/${workId}`, {
    method: "DELETE",
    token,
  });
}

export function reorderListItems(
  listId: string,
  items: Array<{ workId: string; position: number }>,
  token: string,
) {
  return apiRequest<FictrioList>(`/lists/${listId}/items/order`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ items }),
  });
}

export function rateList(listId: string, value: number, token: string) {
  return apiRequest<UpsertRatingResponse>(`/lists/${listId}/rating`, {
    method: "PUT",
    token,
    body: JSON.stringify({ value }),
  });
}

export function deleteListRating(listId: string, token: string) {
  return apiRequest<DeletedResponse & { rating: RatingStats }>(
    `/lists/${listId}/rating`,
    {
      method: "DELETE",
      token,
    },
  );
}
