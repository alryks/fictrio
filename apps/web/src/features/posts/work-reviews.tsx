"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import { useAuthStore } from "@/features/auth/auth-store";
import { upsertWorkRating } from "@/features/ratings/ratings-api";
import type { WorkDetails } from "@/features/works/works-api";
import {
  createWorkReview,
  deleteReview,
  getWorkReviews,
  Review,
  updateReview,
} from "./reviews-api";

type WorkReviewsProps = {
  work: WorkDetails;
};

const ratingOptions = [0, 1, 2, 3];

export function WorkReviews({ work }: WorkReviewsProps) {
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated, hydrate } = useAuthStore();
  const [ratingDraft, setRatingDraft] = useState<number | null>(null);
  const [reviewDraft, setReviewDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const reviewsQuery = useQuery({
    queryKey: ["work", work.id, "reviews"],
    queryFn: () => getWorkReviews(work.id),
  });

  const ownReview = useMemo(
    () =>
      reviewsQuery.data?.items.find((review) => review.author.id === user?.id),
    [reviewsQuery.data?.items, user?.id],
  );
  const ratingValue = ratingDraft ?? work.userRating ?? ownReview?.rating ?? 0;
  const reviewBody = reviewDraft ?? ownReview?.body ?? "";

  const ratingMutation = useMutation({
    mutationFn: (value: number) => {
      if (!accessToken) {
        throw new Error("Для оценки нужно войти в аккаунт");
      }

      return upsertWorkRating(work.id, value, accessToken);
    },
    onSuccess: async (response) => {
      setMessage("Оценка сохранена");
      setRatingDraft(response.value);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["work", work.id] }),
        queryClient.invalidateQueries({ queryKey: ["works"] }),
        queryClient.invalidateQueries({
          queryKey: ["work", work.id, "reviews"],
        }),
      ]);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить оценку",
      );
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для отзыва нужно войти в аккаунт");
      }

      return ownReview
        ? updateReview(ownReview.id, reviewBody.trim(), accessToken)
        : createWorkReview(work.id, reviewBody.trim(), accessToken);
    },
    onSuccess: async () => {
      setMessage(ownReview ? "Отзыв обновлен" : "Отзыв опубликован");
      await queryClient.invalidateQueries({
        queryKey: ["work", work.id, "reviews"],
      });
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить отзыв",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!accessToken || !ownReview) {
        throw new Error("Отзыв не найден");
      }

      return deleteReview(ownReview.id, accessToken);
    },
    onSuccess: async () => {
      setMessage("Отзыв удален");
      setReviewDraft("");
      await queryClient.invalidateQueries({
        queryKey: ["work", work.id, "reviews"],
      });
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось удалить отзыв",
      );
    },
  });

  function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    reviewMutation.mutate();
  }

  return (
    <section className="mt-6 grid gap-6 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="rounded-md border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Ваша оценка и отзыв</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Сначала поставьте оценку, затем можно опубликовать отзыв.
        </p>

        <div className="mt-4">
          <p className="text-sm font-medium">Оценка</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {ratingOptions.map((value) => (
              <button
                className="flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-medium transition hover:border-primary disabled:opacity-60 data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-primary"
                data-active={ratingValue === value}
                disabled={!isHydrated || !user || ratingMutation.isPending}
                key={value}
                onClick={() => {
                  setMessage(null);
                  ratingMutation.mutate(value);
                }}
                type="button"
              >
                <RatingMark value={value} size="sm" />
                {value}
              </button>
            ))}
          </div>
        </div>

        <form className="mt-5 space-y-3" onSubmit={handleReviewSubmit}>
          <label className="block">
            <span className="text-sm font-medium">Отзыв</span>
            <textarea
              className="mt-1 min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              disabled={!isHydrated || !user || reviewMutation.isPending}
              maxLength={5000}
              onChange={(event) => setReviewDraft(event.target.value)}
              placeholder="Что стоит обсудить после просмотра или чтения?"
              required
              value={reviewBody}
            />
          </label>
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          {!user && isHydrated ? (
            <p className="text-sm text-muted-foreground">
              Войдите в аккаунт на главной странице, чтобы оценивать и писать
              отзывы.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-[var(--fictrio-accent)] disabled:opacity-60"
              disabled={
                !user ||
                reviewMutation.isPending ||
                reviewBody.trim().length === 0
              }
              type="submit"
            >
              {ownReview ? (
                <Pencil className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {ownReview ? "Обновить отзыв" : "Опубликовать отзыв"}
            </button>
            {ownReview ? (
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-60"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                type="button"
              >
                <Trash2 className="size-4" />
                Удалить
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="rounded-md border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Отзывы</h2>
          <MessageCircle className="size-4 text-primary" />
        </div>

        {reviewsQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Загружаем отзывы...
          </p>
        ) : null}

        {reviewsQuery.isError ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {reviewsQuery.error.message}
          </p>
        ) : null}

        {reviewsQuery.data?.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Отзывов пока нет. Станьте первым, кто начнет обсуждение.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {reviewsQuery.data?.items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="rounded-md border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
            {review.author.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {review.author.displayName}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              @{review.author.username} · {formatDate(review.createdAt)}
            </p>
          </div>
        </div>
        {review.rating === null ? null : (
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary">
            <RatingMark value={review.rating} size="sm" />
            {review.rating}
          </span>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
        {review.body}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Комментариев: {review.commentsCount}
      </p>
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
