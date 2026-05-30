"use client";

import { useMemo, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { StateCard } from "@/components/state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import { ListCard } from "@/features/lists/list-card";
import { ReviewDiscussionCard } from "@/features/posts/review-discussion";
import type { Review } from "@/features/posts/reviews-api";
import { WorkCard } from "@/features/works/work-card";
import type {
  FeedFilter,
  FeedListActivity,
  FeedPostActivity,
  FeedPage,
} from "./feed-api";

type FeedViewProps = {
  queryKey: (filter: FeedFilter) => QueryKey;
  fetchPage: (filter: FeedFilter, offset: number) => Promise<FeedPage>;
  emptyTitle: string;
  emptyText?: string;
};

const filterOptions: Array<{ value: FeedFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "posts", label: "Оценки и отзывы" },
  { value: "lists", label: "Списки" },
];

export function FeedView({
  queryKey,
  fetchPage,
  emptyTitle,
  emptyText,
}: FeedViewProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FeedFilter>("all");
  const activeKey = queryKey(filter);

  const feedQuery = useInfiniteQuery({
    queryKey: activeKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPage(filter, pageParam),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;

      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });

  const items = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data?.pages],
  );

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: feedQuery.hasNextPage,
    isFetchingNextPage: feedQuery.isFetchingNextPage,
    fetchNextPage: feedQuery.fetchNextPage,
    rootMargin: "600px 0px",
  });

  const invalidateFeed = () =>
    queryClient.invalidateQueries({ queryKey: activeKey });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 overflow-hidden rounded-md border bg-card text-sm font-medium">
        {filterOptions.map((option, index) => (
          <button
            key={option.value}
            className={cn(
              "h-11 px-2 transition",
              index > 0 ? "border-l" : "",
              filter === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
            onClick={() => setFilter(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {feedQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : null}

      {feedQuery.isError ? (
        <StateCard
          title="Не удалось загрузить ленту"
          text={feedQuery.error.message}
        />
      ) : null}

      {!feedQuery.isLoading && !feedQuery.isError && items.length === 0 ? (
        <StateCard title={emptyTitle} text={emptyText} />
      ) : null}

      <div className="space-y-4">
        {items.map((item) =>
          item.kind === "list" ? (
            <ListActivityCard key={`list-${item.id}`} activity={item} />
          ) : (
            <PostActivityCard key={`post-${item.id}`} activity={item} onMutated={invalidateFeed} />
          ),
        )}
      </div>

      <div ref={loadMoreRef} className="h-px" />

      {feedQuery.isFetchingNextPage ? (
        <Skeleton className="h-40 w-full" />
      ) : null}
    </div>
  );
}

function ListActivityCard({ activity }: { activity: FeedListActivity }) {
  return <ListCard list={activity.list} />;
}

function PostActivityCard({
  activity,
  onMutated,
}: {
  activity: FeedPostActivity;
  onMutated: () => Promise<unknown> | unknown;
}) {
  // Adapt the feed activity to the work-page review shape so the discussion
  // (comments load/post) behaves identically. A bare rating has no review id
  // and renders without a comment thread.
  const review: Review = {
    id: activity.reviewId ?? activity.id,
    kind: activity.postKind,
    body: activity.body,
    isHidden: activity.isHidden,
    createdAt: activity.createdAt,
    updatedAt: activity.createdAt,
    author: activity.actor,
    rating: activity.rating,
    commentsCount: activity.commentsCount,
  };

  return (
    <article className="grid gap-4 rounded-md border bg-card p-4 shadow-sm sm:grid-cols-[160px_minmax(0,1fr)]">
      <div className="w-40">
        <WorkCard work={activity.work} />
      </div>

      <div className="min-w-0">
        <ReviewDiscussionCard review={review} onMutated={onMutated} />
      </div>
    </article>
  );
}
