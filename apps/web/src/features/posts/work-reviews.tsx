"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { MessageCircle, PenLine, Pencil, Send, Trash2 } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  deleteWorkRating,
  upsertWorkRating,
} from "@/features/ratings/ratings-api";
import { RatingControl } from "@/features/ratings/rating-control";
import type { WorkDetails } from "@/features/works/works-api";
import {
  createReviewComment,
  createWorkReview,
  deleteComment,
  deleteReview,
  getReviewComments,
  getWorkReviews,
  Review,
  ReviewAuthor,
  ReviewComment,
  updateComment,
  updateReview,
} from "./reviews-api";

type WorkReviewsProps = {
  work: WorkDetails;
};

const REVIEWS_PAGE_SIZE = 10;
const COMMENTS_PAGE_SIZE = 5;

export function WorkReviews({ work }: WorkReviewsProps) {
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated, hydrate } = useAuthStore();
  const [ratingDraft, setRatingDraft] = useState<
    number | null | undefined
  >();
  const [reviewDraft, setReviewDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const activityQuery = useInfiniteQuery({
    queryKey: ["work", work.id, "reviews"],
    queryFn: ({ pageParam }) =>
      getWorkReviews(work.id, pageParam, REVIEWS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;

      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });
  const activityItems = useMemo(
    () => activityQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activityQuery.data?.pages],
  );
  const fetchNextReviewsPage = activityQuery.fetchNextPage;
  const hasNextReviewsPage = activityQuery.hasNextPage;
  const isFetchingNextReviewsPage = activityQuery.isFetchingNextPage;

  useEffect(() => {
    function handleScroll() {
      const distanceToBottom =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;

      if (
        distanceToBottom < 500 &&
        hasNextReviewsPage &&
        !isFetchingNextReviewsPage
      ) {
        void fetchNextReviewsPage();
      }
    }

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchNextReviewsPage, hasNextReviewsPage, isFetchingNextReviewsPage]);

  const ownReview = useMemo(
    () =>
      activityItems.find(
        (item) => item.kind === "review" && item.author.id === user?.id,
      ),
    [activityItems, user?.id],
  );
  const ownRating = useMemo(
    () => activityItems.find((item) => item.author.id === user?.id),
    [activityItems, user?.id],
  );
  const ratingValue =
    ratingDraft === undefined
      ? (ownRating?.rating ?? work.userRating ?? 0)
      : (ratingDraft ?? 0);
  const hasRating =
    ratingDraft === undefined
      ? ownRating?.rating !== undefined || work.userRating != null
      : ratingDraft !== null;
  const reviewBody = reviewDraft ?? ownReview?.body ?? "";

  const ratingMutation = useMutation({
    mutationFn: (value: number) => {
      if (!accessToken) {
        throw new Error("Для оценки нужно войти в аккаунт");
      }

      return upsertWorkRating(work.id, value, accessToken);
    },
    onSuccess: async (response) => {
      setRatingDraft(response.value);
      await invalidateWorkQueries(queryClient, work.id);
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
      setRatingDraft(null);
      setReviewDraft("");
      await invalidateWorkQueries(queryClient, work.id);
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
      <div
        className="scroll-mt-20 rounded-md border bg-card p-4 shadow-sm"
        id="work-review-form"
      >
        <form className="space-y-4" onSubmit={handleReviewSubmit}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <PenLine className="size-4 shrink-0 text-primary" />
                <h2 className="text-lg font-semibold">Ваш отзыв</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Отзыв можно опубликовать после выставления оценки.
              </p>
            </div>

            <RatingControl
              value={ratingValue}
              hasValue={hasRating}
              disabled={!isHydrated || !user || ratingMutation.isPending}
              deleteDisabled={!user || !hasRating || deleteRatingMutation.isPending}
              onChange={handleRatingClick}
              onDelete={() => deleteRatingMutation.mutate()}
            />
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
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 shrink-0 text-primary" />
          <h2 className="text-lg font-semibold">Отзывы и оценки</h2>
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

        {activityItems.length === 0 && !activityQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Оценок и отзывов пока нет. Станьте первым, кто начнет обсуждение.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {activityItems.map((review) => (
            <ReviewDiscussionCard
              key={review.id}
              review={review}
              workId={work.id}
            />
          ))}
        </div>
        {activityQuery.isFetchingNextPage ? (
          <p className="mt-4 text-sm text-muted-foreground">Загружаем еще...</p>
        ) : null}
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
    queryClient.invalidateQueries({ queryKey: ["review"] }),
  ]);
}

function ReviewDiscussionCard({
  review,
  workId,
}: {
  review: Review;
  workId: string;
}) {
  const body =
    review.kind === "review" && review.body
      ? review.body
      : "Поставлена оценка.";
  const isMuted = review.kind !== "review";

  return (
    <article className="rounded-md border bg-background p-4">
      <PostContent
        author={review.author}
        body={body}
        createdAt={review.createdAt}
        isMuted={isMuted}
        rating={review.rating}
      />
      {review.kind === "review" ? (
        <CommentThread review={review} workId={workId} />
      ) : null}
    </article>
  );
}

function PostContent({
  author,
  body,
  createdAt,
  isMuted = false,
  rating,
}: {
  author: ReviewAuthor;
  body: string;
  createdAt: string;
  isMuted?: boolean;
  rating: number | null;
}) {
  return (
    <>
      <header className="flex h-10 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
            {author.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {author.displayName}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              @{author.username} · {formatDate(createdAt)}
            </p>
          </div>
        </div>
        {rating === null ? null : (
          <div className="shrink-0 leading-none">
            <RatingMark value={rating} size="xl" />
          </div>
        )}
      </header>
      <p
        className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${
          isMuted ? "text-muted-foreground" : ""
        }`}
      >
        {body}
      </p>
    </>
  );
}

function CommentList({
  comments,
  reviewId,
  workId,
}: {
  comments: ReviewComment[];
  reviewId: string;
  workId: string;
}) {
  return (
    <div className="divide-y">
      {comments.map((comment) => (
        <CommentItem
          comment={comment}
          key={comment.id}
          reviewId={reviewId}
          workId={workId}
        />
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  reviewId,
  workId,
}: {
  comment: ReviewComment;
  reviewId: string;
  workId: string;
}) {
  const queryClient = useQueryClient();
  const { accessToken, user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(comment.body);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const isOwnComment = user?.id === comment.author.id;

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для редактирования нужно войти в аккаунт");
      }

      return updateComment(comment.id, editDraft.trim(), accessToken);
    },
    onSuccess: async () => {
      setIsEditing(false);
      setEditMessage(null);
      await queryClient.invalidateQueries({
        queryKey: ["review", reviewId, "comments"],
      });
    },
    onError: (error) => {
      setEditMessage(
        error instanceof Error
          ? error.message
          : "Не удалось обновить комментарий",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для удаления нужно войти в аккаунт");
      }

      return deleteComment(comment.id, accessToken);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["review", reviewId, "comments"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["work", workId, "reviews"],
        }),
      ]);
    },
    onError: (error) => {
      setEditMessage(
        error instanceof Error
          ? error.message
          : "Не удалось удалить комментарий",
      );
    },
  });

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditMessage(null);
    updateMutation.mutate();
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditDraft(comment.body);
    setEditMessage(null);
  }

  return (
    <article className="py-3 first:pt-0 last:pb-0">
      <header className="flex h-10 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
            {comment.author.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {comment.author.displayName}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              @{comment.author.username} · {formatDate(comment.createdAt)}
            </p>
          </div>
        </div>
        {comment.rating !== null ? (
          <div className="shrink-0 leading-none">
            <RatingMark value={comment.rating} size="xl" />
          </div>
        ) : null}
      </header>

      {isEditing ? (
        <form className="mt-3 space-y-2" onSubmit={handleEditSubmit}>
          <textarea
            className="min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            disabled={updateMutation.isPending}
            maxLength={2000}
            onChange={(event) => setEditDraft(event.target.value)}
            required
            value={editDraft}
          />
          {editMessage ? (
            <p className="text-sm text-muted-foreground">{editMessage}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-[var(--fictrio-accent)] disabled:opacity-60"
              disabled={
                updateMutation.isPending || editDraft.trim().length === 0
              }
              type="submit"
            >
              <Send className="size-3.5" />
              Сохранить
            </button>
            <button
              className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition hover:border-primary hover:text-primary disabled:opacity-60"
              disabled={updateMutation.isPending}
              onClick={cancelEdit}
              type="button"
            >
              Отменить
            </button>
            <button
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-60"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              type="button"
            >
              <Trash2 className="size-3.5" />
              Удалить
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {comment.body}
          {isOwnComment ? (
            <button
              className="ml-1.5 inline-grid size-5 shrink-0 translate-y-[1px] place-items-center rounded border text-muted-foreground transition hover:border-primary hover:text-primary"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              <Pencil className="size-3" />
              <span className="sr-only">Редактировать</span>
            </button>
          ) : null}
        </p>
      )}
    </article>
  );
}

function CommentForm({
  commentDraft,
  commentMessage,
  isDisabled,
  isPending,
  isUserMissing,
  onDraftChange,
  onSubmit,
}: {
  commentDraft: string;
  commentMessage: string | null;
  isDisabled: boolean;
  isPending: boolean;
  isUserMissing: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <textarea
        className="min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
        disabled={isDisabled}
        maxLength={2000}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="Ответить на отзыв"
        required
        value={commentDraft}
      />
      {commentMessage ? (
        <p className="text-sm text-muted-foreground">{commentMessage}</p>
      ) : null}
      {isUserMissing ? (
        <p className="text-sm text-muted-foreground">
          Войдите в аккаунт, чтобы участвовать в обсуждении.
        </p>
      ) : null}
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-[var(--fictrio-accent)] disabled:opacity-60"
        disabled={isPending || commentDraft.trim().length === 0}
        type="submit"
      >
        <Send className="size-4" />
        Отправить
      </button>
    </form>
  );
}

function CommentThread({ review, workId }: { review: Review; workId: string }) {
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentMessage, setCommentMessage] = useState<string | null>(null);

  const commentsQuery = useInfiniteQuery({
    queryKey: ["review", review.id, "comments"],
    queryFn: ({ pageParam }) =>
      getReviewComments(review.id, pageParam, COMMENTS_PAGE_SIZE),
    enabled: isOpen,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;

      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });
  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [commentsQuery.data?.pages],
  );

  const commentMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для комментария нужно войти в аккаунт");
      }

      return createReviewComment(review.id, commentDraft.trim(), accessToken);
    },
    onSuccess: async () => {
      setCommentDraft("");
      setCommentMessage(null);
      setIsOpen(true);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["review", review.id, "comments"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["work", workId, "reviews"],
        }),
      ]);
    },
    onError: (error) => {
      setCommentMessage(
        error instanceof Error
          ? error.message
          : "Не удалось опубликовать комментарий",
      );
    },
  });

  function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentMessage(null);
    commentMutation.mutate();
  }

  return (
    <section className="mt-4">
      <button
        className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition hover:border-primary hover:text-primary"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        {isOpen ? "Скрыть" : "Комментарии"}
        <span className="text-muted-foreground">({review.commentsCount})</span>
      </button>

      {isOpen ? (
        <div className="mt-3 space-y-3 pl-8">
          <div className="border-b pb-3">
            <CommentForm
              commentDraft={commentDraft}
              commentMessage={commentMessage}
              isDisabled={!isHydrated || !user || commentMutation.isPending}
              isPending={
                !user ||
                commentMutation.isPending ||
                commentDraft.trim().length === 0
              }
              isUserMissing={!user && isHydrated}
              onDraftChange={setCommentDraft}
              onSubmit={handleCommentSubmit}
            />
          </div>

          {commentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Загружаем комментарии...
            </p>
          ) : null}

          {commentsQuery.isError ? (
            <p className="text-sm text-muted-foreground">
              {commentsQuery.error.message}
            </p>
          ) : null}

          {comments.length === 0 && !commentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Пока нет комментариев.
            </p>
          ) : null}

          {comments.length ? (
            <CommentList
              comments={comments}
              reviewId={review.id}
              workId={workId}
            />
          ) : null}
          {commentsQuery.hasNextPage ? (
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-60"
              disabled={commentsQuery.isFetchingNextPage}
              onClick={() => commentsQuery.fetchNextPage()}
              type="button"
            >
              {commentsQuery.isFetchingNextPage
                ? "Загружаем..."
                : "Загрузить еще"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
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
