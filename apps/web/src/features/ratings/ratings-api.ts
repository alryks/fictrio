import type {
  DeleteRatingResponse,
  UpsertRatingResponse,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type { UpsertRatingResponse };

export function upsertWorkRating(workId: string, value: number, token: string) {
  return apiRequest<UpsertRatingResponse>(`/works/${workId}/rating`, {
    method: "PUT",
    token,
    body: JSON.stringify({ value }),
  });
}

export function deleteWorkRating(workId: string, token: string) {
  return apiRequest<DeleteRatingResponse>(`/works/${workId}/rating`, {
    method: "DELETE",
    token,
  });
}
