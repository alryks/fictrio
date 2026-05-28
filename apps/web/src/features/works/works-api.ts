import type {
  CatalogWorkKind,
  SortOrder,
  WorkDetails,
  WorkKind,
  WorkListItem,
  WorkSeason,
  WorksPage,
  WorksSortBy,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type {
  CatalogWorkKind,
  WorkDetails,
  WorkKind,
  WorkListItem,
  WorkSeason,
};
export type WorksResponse = WorksPage;

export type GetWorksParams = {
  search?: string;
  kinds?: CatalogWorkKind[];
  yearFrom?: string;
  yearTo?: string;
  minRating?: string;
  minRatingsCount?: string;
  sortBy?: WorksSortBy;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
};

export async function getWorks(params: GetWorksParams) {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set("search", params.search);
  }

  for (const kind of params.kinds ?? []) {
    searchParams.append("kinds", kind);
  }

  if (params.yearFrom) {
    searchParams.set("yearFrom", params.yearFrom);
  }

  if (params.yearTo) {
    searchParams.set("yearTo", params.yearTo);
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

  searchParams.set("limit", String(params.limit ?? 24));
  searchParams.set("offset", String(params.offset ?? 0));

  return apiRequest<WorksResponse>(`/works?${searchParams.toString()}`);
}

export async function getWork(id: string) {
  return apiRequest<WorkDetails>(`/works/${id}`);
}
