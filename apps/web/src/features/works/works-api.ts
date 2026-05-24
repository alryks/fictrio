import { apiRequest } from "@/lib/api";

export type WorkKind = "movie" | "show" | "book";

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
};

export type WorksResponse = {
  items: WorkListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type GetWorksParams = {
  search?: string;
  kind?: WorkKind | "all";
  year?: string;
  limit?: number;
  offset?: number;
};

export async function getWorks(params: GetWorksParams) {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set("search", params.search);
  }

  if (params.kind && params.kind !== "all") {
    searchParams.set("kind", params.kind);
  }

  if (params.year) {
    searchParams.set("year", params.year);
  }

  searchParams.set("limit", String(params.limit ?? 24));
  searchParams.set("offset", String(params.offset ?? 0));

  return apiRequest<WorksResponse>(`/works?${searchParams.toString()}`);
}

export async function getWork(id: string) {
  return apiRequest<WorkDetails>(`/works/${id}`);
}
