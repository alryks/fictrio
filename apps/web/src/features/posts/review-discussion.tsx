"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RatingMark } from "@/components/ui/rating-mark";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserLink } from "@/components/user-link";
import { formatDate } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { requireUser } from "@/lib/require-user";
import { isModerator } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useSession } from "@/features/auth/use-session";
import {
  HiddenBadge,
  ModerationToggleButton,
} from "@/features/moderation/moderation-controls";
import {
  createReviewComment,
  deleteComment,
  getReviewComments,
  moderateComment,
  moderateReview,
  Review,
  ReviewAuthor,
  ReviewComment,
  updateComment,
} from "./reviews-api";

const COMMENTS_PAGE_SIZE = 5;

/**
 * Callback fired after a comment is created or removed, so the host can
 * refresh whatever list embeds the review (a work's reviews, a profile feed,
 * the following feed) to keep its comment counter in sync.
 */
type OnMutated = () => Promise<unknown> | unknown;

/**
 * A single review (or bare rating) with its collapsible comment thread. The
 * loading logic and UI are shared between the work page and the activity
 * feeds — only the `onMutated` invalidation differs per host.
 */
export function ReviewDiscussionCard({
  review,
  onMutated,
}: {
  review: Review;
  onMutated: OnMutated;
}) {
  const { user } = useSession();
  const canModerate = isModerator(user) && review.kind === "review";
  const body =
    review.kind === "review" && review.body
      ? review.body
      : "Поставлена оценка.";
  const isMuted = review.kind !== "review";

  const moderationMutation = useMutation({
    mutationFn: () => moderateReview(review.id, review.isHidden ? "restore" : "hide"),
    onSuccess: async () => {
      toast.success(review.isHidden ? "Отзыв раскрыт" : "Отзыв скрыт");
      await onMutated();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось изменить видимость отзыва",
      );
    },
  });

  return (
    <article
      className={cn(
        "rounded-md border bg-background p-4",
        review.isHidden && "border-dashed border-destructive/40 bg-destructive/5",
      )}
    >
      <PostContent
        author={review.author}
        body={body}
        createdAt={review.createdAt}
        isHidden={review.isHidden}
        isMuted={isMuted}
        rating={review.rating}
        action={
          canModerate ? (
            <ModerationToggleButton
              isHidden={review.isHidden}
              isPending={moderationMutation.isPending}
              onToggle={() => moderationMutation.mutate()}
            />
          ) : null
        }
      />
      {review.kind === "review" ? (
        <CommentThread review={review} onMutated={onMutated} />
      ) : null}
    </article>
  );
}

export function PostContent({
  author,
  body,
  createdAt,
  isHidden = false,
  isMuted = false,
  rating,
  action,
}: {
  author: ReviewAuthor;
  body: string;
  createdAt: string;
  isHidden?: boolean;
  isMuted?: boolean;
  rating: number | null;
  action?: ReactNode;
}) {
  return (
    <>
      <header className="flex min-h-10 items-start justify-between gap-3">
        <UserLink user={author} meta={formatDate(createdAt)} />
        <div className="flex shrink-0 items-center gap-2">
          {isHidden ? <HiddenBadge /> : null}
          {rating === null ? null : (
            <div className="leading-none">
              <RatingMark value={rating} size="xl" />
            </div>
          )}
          {action}
        </div>
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
  onMutated,
}: {
  comments: ReviewComment[];
  reviewId: string;
  onMutated: OnMutated;
}) {
  return (
    <div className="divide-y">
      {comments.map((comment) => (
        <CommentItem
          comment={comment}
          key={comment.id}
          reviewId={reviewId}
          onMutated={onMutated}
        />
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  reviewId,
  onMutated,
}: {
  comment: ReviewComment;
  reviewId: string;
  onMutated: OnMutated;
}) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(comment.body);
  const isOwnComment = user?.id === comment.author.id;
  const canModerate = isModerator(user);

  const moderationMutation = useMutation({
    mutationFn: () =>
      moderateComment(comment.id, comment.isHidden ? "restore" : "hide"),
    onSuccess: async () => {
      toast.success(comment.isHidden ? "Комментарий раскрыт" : "Комментарий скрыт");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.reviews.comments(reviewId),
        }),
        onMutated(),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось изменить видимость комментария",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      requireUser(user, "редактирования");
      return updateComment(comment.id, editDraft.trim());
    },
    onSuccess: async () => {
      setIsEditing(false);
      toast.success("Комментарий обновлен");
      await queryClient.invalidateQueries({
        queryKey: qk.reviews.comments(reviewId),
      });
    },
    onError: (error) => {
      toast.error(
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
      toast.success("Комментарий удален");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.reviews.comments(reviewId),
        }),
        onMutated(),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось удалить комментарий",
      );
    },
  });

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateMutation.mutate();
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditDraft(comment.body);
  }

  return (
    <article
      className={cn(
        "py-3 first:pt-0 last:pb-0",
        comment.isHidden &&
          "rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-3",
      )}
    >
      <header className="flex min-h-10 items-start justify-between gap-3">
        <UserLink user={comment.author} meta={formatDate(comment.createdAt)} />
        <div className="flex shrink-0 items-center gap-2">
          {comment.isHidden ? <HiddenBadge /> : null}
          {comment.rating !== null ? (
            <div className="leading-none">
              <RatingMark value={comment.rating} size="xl" />
            </div>
          ) : null}
          {canModerate ? (
            <ModerationToggleButton
              isHidden={comment.isHidden}
              isPending={moderationMutation.isPending}
              onToggle={() => moderationMutation.mutate()}
              size="xs"
            />
          ) : null}
        </div>
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
  isDisabled,
  isPending,
  isUserMissing,
  onDraftChange,
  onSubmit,
}: {
  commentDraft: string;
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

function CommentThread({
  review,
  onMutated,
}: {
  review: Review;
  onMutated: OnMutated;
}) {
  const queryClient = useQueryClient();
  const { user, isLoading } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

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
      setIsOpen(true);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.reviews.comments(review.id),
        }),
        onMutated(),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось опубликовать комментарий",
      );
    },
  });

  function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : null}

          {commentsQuery.isError ? (
            <StateCard
              title="Не удалось загрузить комментарии"
              text={commentsQuery.error.message}
            />
          ) : null}

          {comments.length === 0 &&
          !commentsQuery.isLoading &&
          !commentsQuery.isError ? (
            <StateCard title="Пока нет комментариев" />
          ) : null}

          {comments.length ? (
            <CommentList
              comments={comments}
              reviewId={review.id}
              onMutated={onMutated}
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
