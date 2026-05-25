import { apiRequest } from "@/lib/api";

export type ReviewAuthor = {
  id: string;
  username: string;
  displayName: string;
};

export type Review = {
  id: string;
  kind: "review" | "rating";
  body: string | null;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  author: ReviewAuthor;
  rating: number | null;
  commentsCount: number;
};

export type ReviewComment = {
  id: string;
  body: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  author: ReviewAuthor;
  rating: number | null;
};

export type ReviewsResponse = {
  items: Review[];
  total: number;
  limit: number;
  offset: number;
};

export type ReviewCommentsResponse = {
  items: ReviewComment[];
  total: number;
  limit: number;
  offset: number;
};

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
  return apiRequest<{ deleted: true }>(`/reviews/${reviewId}`, {
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
  return apiRequest<{ deleted: true }>(`/comments/${commentId}`, {
    method: "DELETE",
    token,
  });
}
