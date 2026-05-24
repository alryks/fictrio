import { apiRequest } from "@/lib/api";

export type UpsertRatingResponse = {
  id: string;
  value: number;
  rating: {
    average: number | null;
    count: number;
  };
};

export function upsertWorkRating(workId: string, value: number, token: string) {
  return apiRequest<UpsertRatingResponse>(`/works/${workId}/rating`, {
    method: "PUT",
    token,
    body: JSON.stringify({ value }),
  });
}

export function deleteWorkRating(workId: string, token: string) {
  return apiRequest<{ deleted: true; rating: UpsertRatingResponse["rating"] }>(
    `/works/${workId}/rating`,
    {
      method: "DELETE",
      token,
    },
  );
}
