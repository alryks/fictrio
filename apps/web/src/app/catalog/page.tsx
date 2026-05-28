"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
import { FormField } from "@/components/form-field";
import { qk } from "@/lib/query-keys";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import { WorkCard } from "@/features/works/work-card";
import { getWorks, WorkKind } from "@/features/works/works-api";

const catalogPageSize = 24;
type CatalogWorkKind = Extract<WorkKind, "movie" | "show" | "book">;

const kindOptions: Array<{ value: CatalogWorkKind; label: string }> = [
  { value: "movie", label: "Фильмы" },
  { value: "show", label: "Сериалы" },
  { value: "book", label: "Книги" },
];

const sortOptions = [
  { value: "title", label: "Название" },
  { value: "releaseYear", label: "Дата выхода" },
  { value: "averageRating", label: "Средняя оценка" },
] as const;

const sortOrderOptions = [
  { value: "asc", label: "По возрастанию" },
  { value: "desc", label: "По убыванию" },
] as const;

const kindLabels: Record<CatalogWorkKind, string> = {
  movie: "Фильм",
  show: "Сериал",
  book: "Книга",
};

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <StateCard
          className="mt-5"
          title="Загрузка каталога"
          text="Подготавливаем фильтры и параметры поиска."
        />
      }
    >
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const kinds = getSelectedKinds(searchParams);
  const yearFrom = searchParams.get("yearFrom") ?? "";
  const yearTo = searchParams.get("yearTo") ?? "";
  const minRating = searchParams.get("minRating") ?? "";
  const sortBy = getSortBy(searchParams);
  const sortOrder = getSortOrder(searchParams);

  const worksQuery = useInfiniteQuery({
    queryKey: qk.works.list({
      search,
      kinds,
      yearFrom,
      yearTo,
      minRating,
      sortBy,
      sortOrder,
    }),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getWorks({
        search,
        kinds,
        yearFrom,
        yearTo,
        minRating,
        sortBy,
        sortOrder,
        limit: catalogPageSize,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;

      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });

  const items = worksQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = worksQuery.data?.pages[0]?.total ?? 0;
  const fetchNextPage = worksQuery.fetchNextPage;
  const hasNextPage = worksQuery.hasNextPage;
  const isFetchingNextPage = worksQuery.isFetchingNextPage;

  const loadMoreRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    rootMargin: "600px 0px",
  });

  function updateParams(updates: Record<string, string | string[] | null>) {
    const nextParams = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      nextParams.delete(key);

      if (Array.isArray(value)) {
        for (const item of value) {
          nextParams.append(key, item);
        }
      } else if (value) {
        nextParams.set(key, value);
      }
    }

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function toggleKind(kind: CatalogWorkKind) {
    const nextKinds = kinds.includes(kind)
      ? kinds.filter((item) => item !== kind)
      : [...kinds, kind];

    updateParams({ kinds: nextKinds });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader active="catalog" />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Каталог</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Фильмы, сериалы и книги, которые можно оценивать и обсуждать.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Показано: {items.length} из {total}
          </p>
        </div>

        <Card className="mt-5 grid gap-4 p-4">
          <FormField label="Поиск">
            {(field) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  {...field}
                  className="pl-9"
                  onChange={(event) =>
                    updateParams({ search: event.target.value })
                  }
                  placeholder="Название произведения"
                  type="search"
                  value={search}
                />
              </div>
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-sm font-medium">Тип произведения</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {kindOptions.map((option) => (
                  <label
                    className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition hover:border-primary"
                    key={option.value}
                  >
                    <input
                      checked={kinds.includes(option.value)}
                      className="size-4 accent-[var(--fictrio-primary)]"
                      onChange={() => toggleKind(option.value)}
                      type="checkbox"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">Год</p>
              <div className="mt-2 flex gap-2">
                <Input
                  max={2100}
                  min={1800}
                  onChange={(event) =>
                    updateParams({ yearFrom: event.target.value })
                  }
                  placeholder="от"
                  type="number"
                  value={yearFrom}
                />
                <Input
                  max={2100}
                  min={1800}
                  onChange={(event) =>
                    updateParams({ yearTo: event.target.value })
                  }
                  placeholder="до"
                  type="number"
                  value={yearTo}
                />
              </div>
            </div>

            <div className="sm:col-span-2 xl:col-span-1">
              <FormField label="Оценка от">
                {(field) => (
                  <Input
                    {...field}
                    max={3}
                    min={0}
                    onChange={(event) =>
                      updateParams({ minRating: event.target.value })
                    }
                    placeholder="2.0"
                    step="0.1"
                    type="number"
                    value={minRating}
                  />
                )}
              </FormField>
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
                  onValueChange={(value) => updateParams({ sortOrder: value })}
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

        {worksQuery.isLoading ? (
          <StateCard
            className="mt-5"
            title="Загрузка каталога"
            text="Получаем произведения из API."
          />
        ) : null}

        {worksQuery.isError ? (
          <StateCard
            className="mt-5"
            title="Не удалось загрузить каталог"
            text={worksQuery.error.message}
          />
        ) : null}

        {!worksQuery.isLoading && !worksQuery.isError && items.length === 0 ? (
          <StateCard
            className="mt-5"
            title="Ничего не найдено"
            text="Измените поисковый запрос, тип или год."
          />
        ) : null}

        {items.length > 0 ? (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </section>
        ) : null}

        <div ref={loadMoreRef} className="h-8" />

        {isFetchingNextPage ? (
          <StateCard
            className="mt-5"
            title="Загружаем еще"
            text="Подбираем следующую порцию произведений."
          />
        ) : null}

        {hasNextPage && !isFetchingNextPage ? (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => void fetchNextPage()}
              type="button"
            >
              Загрузить еще
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function getSelectedKinds(searchParams: URLSearchParams): CatalogWorkKind[] {
  return searchParams
    .getAll("kinds")
    .filter((kind): kind is CatalogWorkKind => kind in kindLabels);
}

function getSortBy(searchParams: URLSearchParams) {
  const sortBy = searchParams.get("sortBy");

  return sortOptions.some((option) => option.value === sortBy)
    ? (sortBy as (typeof sortOptions)[number]["value"])
    : "averageRating";
}

function getSortOrder(searchParams: URLSearchParams) {
  const sortOrder = searchParams.get("sortOrder");

  return sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";
}
