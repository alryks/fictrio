"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/form-field";
import { qk } from "@/lib/query-keys";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import { useSession } from "@/features/auth/use-session";
import {
  getPublicLists,
  ListsSortBy,
  ListsSortOrder,
} from "@/features/lists/lists-api";
import { ListCard } from "@/features/lists/list-card";

const pageSize = 12;

const sortOptions = [
  { value: "averageRating", label: "Средняя оценка" },
  { value: "ratingCount", label: "Количество оценок" },
  { value: "createdAt", label: "Дата создания" },
  { value: "updatedAt", label: "Дата обновления" },
] as const;

const sortOrderOptions = [
  { value: "asc", label: "По возрастанию" },
  { value: "desc", label: "По убыванию" },
] as const;

export default function ListsPage() {
  return (
    <Suspense
      fallback={
        <StateCard
          className="mt-5"
          title="Загрузка списков"
          text="Подготавливаем фильтры и параметры сортировки."
        />
      }
    >
      <ListsContent />
    </Suspense>
  );
}

function ListsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const minRating = searchParams.get("minRating") ?? "";
  const minRatingsCount = searchParams.get("minRatingsCount") ?? "";
  const sortBy = getSortBy(searchParams);
  const sortOrder = getSortOrder(searchParams);
  const { user } = useSession();
  const viewerScope = user ? `${user.id}:${user.roles.join(",")}` : "guest";

  const listsQuery = useInfiniteQuery({
    queryKey: qk.lists.public({
      viewer: viewerScope,
      search,
      minRating,
      minRatingsCount,
      sortBy,
      sortOrder,
    }),
    queryFn: ({ pageParam }) =>
      getPublicLists({
        search,
        minRating,
        minRatingsCount,
        sortBy,
        sortOrder,
        offset: pageParam,
        limit: pageSize,
      }),
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
  const total = listsQuery.data?.pages[0]?.total ?? 0;
  const fetchNextPage = listsQuery.fetchNextPage;
  const hasNextPage = listsQuery.hasNextPage;
  const isFetchingNextPage = listsQuery.isFetchingNextPage;
  const loadMoreRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    rootMargin: "600px 0px",
  });

  function updateParams(updates: Record<string, string | null>) {
    const nextParams = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      nextParams.delete(key);

      if (value) {
        nextParams.set(key, value);
      }
    }

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

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
              Показано: {lists.length} из {total}
            </p>
          </div>

          <Card className="mt-5 grid gap-4 p-4">
            <FormField label="Название">
              {(field) => (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...field}
                    className="pl-9"
                    onChange={(event) =>
                      updateParams({ search: event.target.value })
                    }
                    placeholder="Название списка"
                    type="search"
                    value={search}
                  />
                </div>
              )}
            </FormField>

            <div>
              <p className="text-sm font-medium">Оценка</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label="Минимальная средняя оценка"
                  max={3}
                  min={0}
                  onChange={(event) =>
                    updateParams({ minRating: event.target.value })
                  }
                  placeholder="Минимальная средняя"
                  step="0.1"
                  type="number"
                  value={minRating}
                />
                <Input
                  aria-label="Количество оценок"
                  min={0}
                  onChange={(event) =>
                    updateParams({ minRatingsCount: event.target.value })
                  }
                  placeholder="Количество оценок"
                  step="1"
                  type="number"
                  value={minRatingsCount}
                />
              </div>
            </div>

            <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
              <FormField label="Сортировка">
                {(field) => (
                  <Select
                    value={sortBy}
                    onValueChange={(value) => updateParams({ sortBy: value })}
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField label="Порядок">
                {(field) => (
                  <Select
                    value={sortOrder}
                    onValueChange={(value) =>
                      updateParams({ sortOrder: value })
                    }
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOrderOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>
          </Card>

          {listsQuery.isLoading ? <ListsSkeleton /> : null}
          {listsQuery.isError ? (
            <StateCard
              className="mt-5"
              title="Не удалось загрузить списки"
              text={listsQuery.error.message}
            />
          ) : null}
          {lists.length === 0 && !listsQuery.isLoading ? (
            <StateCard
              className="mt-5"
              title="Списков не найдено"
              text="Измените название, оценку или сортировку."
            />
          ) : null}

          <div className="mt-5 grid min-w-0 gap-4">
            {lists.map((list) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>

          <div ref={loadMoreRef} className="h-8" />

          {isFetchingNextPage ? <ListsSkeleton /> : null}

          {hasNextPage && !isFetchingNextPage ? (
            <Button
              variant="outline"
              className="mt-5 h-10"
              onClick={() => void fetchNextPage()}
              type="button"
            >
              Показать еще
            </Button>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function ListsSkeleton() {
  return (
    <div className="mt-5 grid min-w-0 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-44 w-full" />
      ))}
    </div>
  );
}

function getSortBy(searchParams: URLSearchParams): ListsSortBy {
  const sortBy = searchParams.get("sortBy");
  const match = sortOptions.find((option) => option.value === sortBy);

  return match?.value ?? "updatedAt";
}

function getSortOrder(searchParams: URLSearchParams): ListsSortOrder {
  const sortOrder = searchParams.get("sortOrder");

  return sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";
}
