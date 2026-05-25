import { apiRequest } from "@/lib/api";
import type { WorkListItem } from "@/features/works/works-api";

export type ListOwner = {
  id: string;
  username: string;
  displayName: string;
};

export type FictrioList = {
  id: string;
  title: string;
  description: string | null;
  visibility: "public" | "friends" | "private";
  createdAt: string;
  updatedAt: string;
  owner: ListOwner;
  rating: {
    average: number | null;
    count: number;
  };
  userRating: number | null;
  items: Array<{
    position: number;
    addedAt: string;
    work: WorkListItem;
  }>;
};

export type ListsResponse = {
  items: FictrioList[];
  total: number;
  limit?: number;
  offset?: number;
};

export function getPublicLists(offset = 0, limit = 12) {
  return apiRequest<ListsResponse>(`/lists?offset=${offset}&limit=${limit}`);
}

export function getMyLists(token: string) {
  return apiRequest<ListsResponse>("/lists/mine", { token });
}

export function getList(id: string) {
  return apiRequest<FictrioList>(`/lists/${id}`);
}

export function createList(
  input: {
    title: string;
    description?: string | null;
    visibility: FictrioList["visibility"];
  },
  token: string,
) {
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
  return apiRequest<{
    id: string;
    value: number;
    rating: FictrioList["rating"];
  }>(`/lists/${listId}/rating`, {
    method: "PUT",
    token,
    body: JSON.stringify({ value }),
  });
}
