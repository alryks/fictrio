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
};

export type ReviewsResponse = {
  items: Review[];
};

export type ReviewCommentsResponse = {
  items: ReviewComment[];
};

export function getWorkReviews(workId: string) {
  return apiRequest<ReviewsResponse>(`/works/${workId}/reviews`);
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

export function getReviewComments(reviewId: string) {
  return apiRequest<ReviewCommentsResponse>(`/reviews/${reviewId}/comments`);
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
