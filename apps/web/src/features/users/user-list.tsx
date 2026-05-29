"use client";

import { useMemo, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { StateCard } from "@/components/state-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserLink } from "@/components/user-link";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import type { UsersPage, UserSummary } from "./users-api";
import { FollowButton } from "./follow-button";

type UserListProps = {
  queryKey: (search: string) => QueryKey;
  fetchPage: (search: string, offset: number) => Promise<UsersPage>;
  emptyTitle: string;
  emptyText?: string;
  /** Render inside a fixed-height scroll container (used in dialogs). */
  bounded?: boolean;
};

/**
 * Username-search + infinite-scroll list of users with a follow toggle on
 * each row. Shared between the people search page and the followers/following
 * dialogs — the only difference is which endpoint `fetchPage` hits.
 */
export function UserList({
  queryKey,
  fetchPage,
  emptyTitle,
  emptyText,
  bounded = false,
}: UserListProps) {
  const [search, setSearch] = useState("");
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  const query = useInfiniteQuery({
    queryKey: queryKey(search),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPage(search, pageParam),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;

      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });

  const users = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data?.pages],
  );
  const total = query.data?.pages[0]?.total ?? 0;

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    root: bounded ? scrollRoot : null,
    rootMargin: bounded ? "0px 0px 240px 0px" : "600px 0px",
  });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Поиск по имени пользователя"
          className="pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Имя пользователя"
          type="search"
          value={search}
        />
      </div>

      {!query.isLoading && !query.isError ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Найдено: {total}
        </p>
      ) : null}

      <div
        className={
          bounded
            ? "mt-3 max-h-[60vh] space-y-3 overflow-y-auto pr-1"
            : "mt-3 space-y-3"
        }
        ref={bounded ? setScrollRoot : undefined}
      >
        {query.isLoading ? (
          <UserListSkeleton />
        ) : null}

        {query.isError ? (
          <StateCard
            title="Не удалось загрузить пользователей"
            text={query.error.message}
          />
        ) : null}

        {!query.isLoading && !query.isError && users.length === 0 ? (
          <StateCard title={emptyTitle} text={emptyText} />
        ) : null}

        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}

        <div ref={loadMoreRef} className="h-px" />

        {query.isFetchingNextPage ? <UserListSkeleton rows={2} /> : null}
      </div>
    </div>
  );
}

function UserRow({ user }: { user: UserSummary }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
      <UserLink
        user={user}
        meta={`${user.followersCount} подписчиков`}
        className="min-w-0 flex-1"
      />
      <FollowButton
        username={user.username}
        isFollowedByViewer={user.isFollowedByViewer}
        isSelf={user.isSelf}
        size="sm"
      />
    </div>
  );
}

function UserListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </>
  );
}
