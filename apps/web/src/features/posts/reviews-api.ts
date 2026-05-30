import type {
  DeletedResponse,
  ModerationInput,
  ModerationResult,
  PublicUserRef,
  Review,
  ReviewComment,
  ReviewCommentsPage,
  ReviewsPage,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type ReviewAuthor = PublicUserRef;
export type { ModerationResult };
export type ModerationAction = ModerationInput["action"];
export type { Review, ReviewComment };
export type ReviewsResponse = ReviewsPage;
export type ReviewCommentsResponse = ReviewCommentsPage;

export function getWorkReviews(workId: string, offset = 0, limit = 10) {
  return apiRequest<ReviewsResponse>(
    `/works/${workId}/reviews?offset=${offset}&limit=${limit}`,
  );
}

export function createWorkReview(workId: string, body: string) {
  return apiRequest<Review>(`/works/${workId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function updateReview(reviewId: string, body: string) {
  return apiRequest<Review>(`/reviews/${reviewId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export function deleteReview(reviewId: string) {
  return apiRequest<DeletedResponse>(`/reviews/${reviewId}`, {
    method: "DELETE",
  });
}

export function getReviewComments(reviewId: string, offset = 0, limit = 5) {
  return apiRequest<ReviewCommentsResponse>(
    `/reviews/${reviewId}/comments?offset=${offset}&limit=${limit}`,
  );
}

export function createReviewComment(reviewId: string, body: string) {
  return apiRequest<ReviewComment>(`/reviews/${reviewId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function updateComment(commentId: string, body: string) {
  return apiRequest<ReviewComment>(`/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export function deleteComment(commentId: string) {
  return apiRequest<DeletedResponse>(`/comments/${commentId}`, {
    method: "DELETE",
  });
}

export function moderateReview(reviewId: string, action: ModerationAction) {
  return apiRequest<ModerationResult>(`/reviews/${reviewId}/moderation`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export function moderateComment(commentId: string, action: ModerationAction) {
  return apiRequest<ModerationResult>(`/comments/${commentId}/moderation`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
