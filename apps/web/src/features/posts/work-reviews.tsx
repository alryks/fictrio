"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { MessageCircle, PenLine, Pencil, Send, Trash2 } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserBadge } from "@/components/user-badge";
import { FormField } from "@/components/form-field";
import { formatDate } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import { useSession } from "@/features/auth/use-session";
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

function requireUser(user: unknown, action: string): asserts user {
  if (!user) {
    throw new Error(`Для ${action} нужно войти в аккаунт`);
  }
}

type WorkReviewsProps = {
  work: WorkDetails;
};

const REVIEWS_PAGE_SIZE = 10;
const COMMENTS_PAGE_SIZE = 5;

export function WorkReviews({ work }: WorkReviewsProps) {
  const queryClient = useQueryClient();
  const { user, isLoading } = useSession();
  const [ratingDraft, setRatingDraft] = useState<
    number | null | undefined
  >();
  const [reviewDraft, setReviewDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activityQuery = useInfiniteQuery({
    queryKey: qk.works.reviews(work.id),
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
  const loadMoreRef = useInfiniteScroll({
    hasNextPage: activityQuery.hasNextPage,
    isFetchingNextPage: activityQuery.isFetchingNextPage,
    fetchNextPage: activityQuery.fetchNextPage,
    rootMargin: "500px 0px",
  });

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
      requireUser(user, "оценки");
      return upsertWorkRating(work.id, value);
    },
    onSuccess: async (response) => {
      setRatingDraft(response.value);
      await invalidateWorkQueries(queryClient, work.id);
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: () => {
      requireUser(user, "удаления оценки");
      return deleteWorkRating(work.id);
    },
    onSuccess: async () => {
      setRatingDraft(null);
      setReviewDraft("");
      await invalidateWorkQueries(queryClient, work.id);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      requireUser(user, "отзыва");
      return ownReview
        ? updateReview(ownReview.id, reviewBody.trim())
        : createWorkReview(work.id, reviewBody.trim());
    },
    onSuccess: async () => {
      setMessage(ownReview ? "Отзыв обновлен" : "Отзыв опубликован");
      await queryClient.invalidateQueries({
        queryKey: qk.works.reviews(work.id),
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
      requireUser(user, "удаления отзыва");
      if (!ownReview) {
        throw new Error("Отзыв не найден");
      }
      return deleteReview(ownReview.id);
    },
    onSuccess: async () => {
      setMessage("Отзыв удален");
      setReviewDraft("");
      await queryClient.invalidateQueries({
        queryKey: qk.works.reviews(work.id),
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
              disabled={isLoading || !user || ratingMutation.isPending}
              deleteDisabled={!user || !hasRating || deleteRatingMutation.isPending}
              onChange={handleRatingClick}
              onDelete={() => deleteRatingMutation.mutate()}
            />
          </div>

          <FormField label="Текст отзыва">
            {(field) => (
              <Textarea
                {...field}
                className="min-h-36"
                disabled={isLoading || !user || reviewMutation.isPending}
                maxLength={5000}
                onChange={(event) => setReviewDraft(event.target.value)}
                placeholder="Что стоит обсудить после просмотра или чтения?"
                required
                value={reviewBody}
              />
            )}
          </FormField>
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          {!user && !isLoading ? (
            <p className="text-sm text-muted-foreground">
              Войдите в аккаунт на главной странице, чтобы оценивать и писать
              отзывы.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-10"
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
            </Button>
            {ownReview ? (
              <Button
                variant="destructive"
                className="h-10"
                disabled={deleteReviewMutation.isPending}
                onClick={() => deleteReviewMutation.mutate()}
                type="button"
              >
                <Trash2 className="size-4" />
                Удалить отзыв
              </Button>
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
        <div ref={loadMoreRef} className="h-px" />
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
    queryClient.invalidateQueries({ queryKey: qk.works.detail(workId) }),
    queryClient.invalidateQueries({ queryKey: qk.works.all }),
    queryClient.invalidateQueries({ queryKey: qk.works.reviews(workId) }),
    queryClient.invalidateQueries({ queryKey: qk.reviews.all }),
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
          <UserBadge name={author.username} />
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
  const { user } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(comment.body);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const isOwnComment = user?.id === comment.author.id;

  const updateMutation = useMutation({
    mutationFn: () => {
      requireUser(user, "редактирования");
      return updateComment(comment.id, editDraft.trim());
    },
    onSuccess: async () => {
      setIsEditing(false);
      setEditMessage(null);
      await queryClient.invalidateQueries({
        queryKey: qk.reviews.comments(reviewId),
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
      requireUser(user, "удаления");
      return deleteComment(comment.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.reviews.comments(reviewId),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.works.reviews(workId),
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
          <UserBadge name={comment.author.username} />
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
          <Textarea
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
            <Button
              size="sm"
              disabled={
                updateMutation.isPending || editDraft.trim().length === 0
              }
              type="submit"
            >
              <Send className="size-3.5" />
              Сохранить
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={cancelEdit}
              type="button"
            >
              Отменить
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              type="button"
            >
              <Trash2 className="size-3.5" />
              Удалить
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {comment.body}
          {isOwnComment ? (
            <Button
              variant="outline"
              size="icon-xs"
              className="ml-1.5 translate-y-[1px]"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              <Pencil className="size-3" />
              <span className="sr-only">Редактировать</span>
            </Button>
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
      <Textarea
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
      <Button
        disabled={isPending || commentDraft.trim().length === 0}
        type="submit"
      >
        <Send className="size-4" />
        Отправить
      </Button>
    </form>
  );
}

function CommentThread({ review, workId }: { review: Review; workId: string }) {
  const queryClient = useQueryClient();
  const { user, isLoading } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentMessage, setCommentMessage] = useState<string | null>(null);

  const commentsQuery = useInfiniteQuery({
    queryKey: qk.reviews.comments(review.id),
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
      requireUser(user, "комментария");
      return createReviewComment(review.id, commentDraft.trim());
    },
    onSuccess: async () => {
      setCommentDraft("");
      setCommentMessage(null);
      setIsOpen(true);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.reviews.comments(review.id),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.works.reviews(workId),
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
      <Button
        variant="outline"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        {isOpen ? "Скрыть" : "Комментарии"}
        <span className="text-muted-foreground">({review.commentsCount})</span>
      </Button>

      {isOpen ? (
        <div className="mt-3 space-y-3 pl-8">
          <div className="border-b pb-3">
            <CommentForm
              commentDraft={commentDraft}
              commentMessage={commentMessage}
              isDisabled={isLoading || !user || commentMutation.isPending}
              isPending={
                !user ||
                commentMutation.isPending ||
                commentDraft.trim().length === 0
              }
              isUserMissing={!user && !isLoading}
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
            <Button
              variant="outline"
              disabled={commentsQuery.isFetchingNextPage}
              onClick={() => commentsQuery.fetchNextPage()}
              type="button"
            >
              {commentsQuery.isFetchingNextPage
                ? "Загружаем..."
                : "Загрузить еще"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
