"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  deleteWorkRating,
  upsertWorkRating,
} from "@/features/ratings/ratings-api";
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

export function WorkReviews({ work }: WorkReviewsProps) {
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated, hydrate } = useAuthStore();
  const [ratingDraft, setRatingDraft] = useState<number | null>(null);
  const [reviewDraft, setReviewDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const activityQuery = useQuery({
    queryKey: ["work", work.id, "reviews"],
    queryFn: () => getWorkReviews(work.id),
  });

  const ownReview = useMemo(
    () =>
      activityQuery.data?.items.find(
        (item) => item.kind === "review" && item.author.id === user?.id,
      ),
    [activityQuery.data?.items, user?.id],
  );
  const ownRating = useMemo(
    () => activityQuery.data?.items.find((item) => item.author.id === user?.id),
    [activityQuery.data?.items, user?.id],
  );
  const ratingValue = ratingDraft ?? ownRating?.rating ?? work.userRating ?? 0;
  const reviewBody = reviewDraft ?? ownReview?.body ?? "";

  const ratingMutation = useMutation({
    mutationFn: (value: number) => {
      if (!accessToken) {
        throw new Error("Для оценки нужно войти в аккаунт");
      }

      return upsertWorkRating(work.id, value, accessToken);
    },
    onSuccess: async (response) => {
      setMessage(response.value === 0 ? "Оценка сброшена" : "Оценка сохранена");
      setRatingDraft(response.value);
      await invalidateWorkQueries(queryClient, work.id);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить оценку",
      );
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для удаления оценки нужно войти в аккаунт");
      }

      return deleteWorkRating(work.id, accessToken);
    },
    onSuccess: async () => {
      setMessage("Оценка и отзыв удалены");
      setRatingDraft(0);
      setReviewDraft("");
      await invalidateWorkQueries(queryClient, work.id);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось удалить оценку",
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

  const deleteReviewMutation = useMutation({
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

  function handleRatingClick() {
    setMessage(null);
    ratingMutation.mutate((Math.floor(ratingValue) + 1) % 4);
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-md border bg-card p-4 shadow-sm">
        <form className="space-y-4" onSubmit={handleReviewSubmit}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Ваш отзыв</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Отзыв можно опубликовать после выставления оценки.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                aria-label="Изменить оценку"
                className="grid size-14 place-items-center rounded-md transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
                disabled={!isHydrated || !user || ratingMutation.isPending}
                onClick={handleRatingClick}
                type="button"
              >
                <RatingMark value={ratingValue} size="lg" />
              </button>
              <button
                aria-label="Удалить оценку"
                className="grid size-14 place-items-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                disabled={!user || deleteRatingMutation.isPending}
                onClick={() => deleteRatingMutation.mutate()}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Текст отзыва</span>
            <textarea
              className="mt-1 min-h-36 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
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
                disabled={deleteReviewMutation.isPending}
                onClick={() => deleteReviewMutation.mutate()}
                type="button"
              >
                <Trash2 className="size-4" />
                Удалить отзыв
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="rounded-md border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Отзывы и оценки</h2>
          <MessageCircle className="size-4 text-primary" />
        </div>

        {activityQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Загружаем активность...
          </p>
        ) : null}

        {activityQuery.isError ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {activityQuery.error.message}
          </p>
        ) : null}

        {activityQuery.data?.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Оценок и отзывов пока нет. Станьте первым, кто начнет обсуждение.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {activityQuery.data?.items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}

async function invalidateWorkQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  workId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["work", workId] }),
    queryClient.invalidateQueries({ queryKey: ["works"] }),
    queryClient.invalidateQueries({ queryKey: ["work", workId, "reviews"] }),
  ]);
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
        <RatingMark value={review.rating ?? 0} size="xl" />
      </div>
      {review.kind === "review" && review.body ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {review.body}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Поставлена оценка.</p>
      )}
      {review.kind === "review" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Комментариев: {review.commentsCount}
        </p>
      ) : null}
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
