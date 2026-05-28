"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/layout/site-header";
import { getPublicLists } from "@/features/lists/lists-api";
import { ListCard } from "@/features/lists/list-card";

const pageSize = 12;

export default function ListsPage() {
  const listsQuery = useInfiniteQuery({
    queryKey: ["lists", "public"],
    queryFn: ({ pageParam }) => getPublicLists(pageParam, pageSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = (lastPage.offset ?? 0) + lastPage.items.length;

      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });
  const lists = useMemo(
    () => listsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listsQuery.data?.pages],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader active="lists" />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">
                Пользовательские списки
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Подборки фильмов, сериалов и книг от пользователей Fictrio.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Найдено: {listsQuery.data?.pages[0]?.total ?? 0}
            </p>
          </div>

          {listsQuery.isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Загружаем списки...
            </p>
          ) : null}
          {listsQuery.isError ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {listsQuery.error.message}
            </p>
          ) : null}
          {lists.length === 0 && !listsQuery.isLoading ? (
            <p className="mt-6 rounded-md border bg-card p-6 text-sm text-muted-foreground">
              Публичных списков пока нет. Создайте первый список для обсуждения.
            </p>
          ) : null}

          <div className="mt-5 grid min-w-0 gap-4">
            {lists.map((list) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>

          {listsQuery.hasNextPage ? (
            <button
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-60"
              disabled={listsQuery.isFetchingNextPage}
              onClick={() => listsQuery.fetchNextPage()}
              type="button"
            >
              {listsQuery.isFetchingNextPage ? "Загрузка..." : "Показать еще"}
            </button>
          ) : null}
        </section>
      </main>
    </div>
  );
}
