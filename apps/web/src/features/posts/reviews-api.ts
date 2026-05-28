import type {
  DeletedResponse,
  PublicUserRef,
  Review,
  ReviewComment,
  ReviewCommentsPage,
  ReviewsPage,
} from "@fictrio/contracts";
import { apiRequest } from "@/lib/api";

export type ReviewAuthor = PublicUserRef;
export type { Review, ReviewComment };
export type ReviewsResponse = ReviewsPage;
export type ReviewCommentsResponse = ReviewCommentsPage;

export function getWorkReviews(workId: string, offset = 0, limit = 10) {
  return apiRequest<ReviewsResponse>(
    `/works/${workId}/reviews?offset=${offset}&limit=${limit}`,
  );
}

export function createWorkReview(workId: string, body: string, token: string) {
  return apiRequest<Review>(`/works/${workId}/reviews`, {
    method: "POST",
    token,
    body: JSON.stringify({ body }),
  });
}

export function updateReview(reviewId: string, body: string, token: string) {
  return apiRequest<Review>(`/reviews/${reviewId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ body }),
  });
}

export function deleteReview(reviewId: string, token: string) {
  return apiRequest<DeletedResponse>(`/reviews/${reviewId}`, {
    method: "DELETE",
    token,
  });
}

export function getReviewComments(reviewId: string, offset = 0, limit = 5) {
  return apiRequest<ReviewCommentsResponse>(
    `/reviews/${reviewId}/comments?offset=${offset}&limit=${limit}`,
  );
}

export function createReviewComment(
  reviewId: string,
  body: string,
  token: string,
) {
  return apiRequest<ReviewComment>(`/reviews/${reviewId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body }),
  });
}

export function updateComment(commentId: string, body: string, token: string) {
  return apiRequest<ReviewComment>(`/comments/${commentId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ body }),
  });
}

export function deleteComment(commentId: string, token: string) {
  return apiRequest<DeletedResponse>(`/comments/${commentId}`, {
    method: "DELETE",
    token,
  });
}
