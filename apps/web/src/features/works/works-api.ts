import { apiRequest } from "@/lib/api";

export type WorkKind = "movie" | "show" | "season" | "episode" | "book";

export type WorkListItem = {
  id: string;
  kind: WorkKind;
  title: string;
  originalTitle: string | null;
  description: string | null;
  releaseYear: number | null;
  imageUrl: string | null;
  rating: {
    average: number | null;
    count: number;
  };
  meta: Record<string, string | number | null>;
};

export type WorkDetails = WorkListItem & {
  details: Record<string, string | number | null> | null;
  seasons?: WorkSeason[];
};

export type WorkSeason = WorkListItem & {
  episodes: WorkListItem[];
};

export type WorksResponse = {
  items: WorkListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type GetWorksParams = {
  search?: string;
  kinds?: Array<Extract<WorkKind, "movie" | "show" | "book">>;
  yearFrom?: string;
  yearTo?: string;
  minRating?: string;
  sortBy?: "title" | "releaseYear" | "averageRating";
  sortOrder?: "asc" | "desc";
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
