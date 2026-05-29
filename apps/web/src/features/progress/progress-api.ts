import type {
  GetProgressQuery,
  ProgressListItem,
  ProgressPage,
  ProgressStatus,
  ProgressSummary,
  UpsertWorkProgressInput,
  WorkProgress,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type {
  ProgressListItem,
  ProgressPage,
  ProgressStatus,
  ProgressSummary,
  UpsertWorkProgressInput,
  WorkProgress,
};

export type GetProgressParams = Partial<GetProgressQuery>;

export function getUserProgressSummary(username: string) {
  return apiRequest<ProgressSummary>(
    `/users/${encodeURIComponent(username)}/progress/summary`,
  );
}

export function getUserProgress(username: string, params: GetProgressParams) {
  const searchParams = new URLSearchParams();
  searchParams.set("status", params.status ?? "started");
  searchParams.set("limit", String(params.limit ?? 24));
  searchParams.set("offset", String(params.offset ?? 0));

  return apiRequest<ProgressPage>(
    `/users/${encodeURIComponent(username)}/progress?${searchParams.toString()}`,
  );
}

export function upsertWorkProgress(
  workId: string,
  input: UpsertWorkProgressInput,
) {
  return apiRequest<WorkProgress>(`/works/${workId}/progress`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteWorkProgress(workId: string) {
  return apiRequest<WorkProgress>(`/works/${workId}/progress`, {
    method: "DELETE",
  });
}
