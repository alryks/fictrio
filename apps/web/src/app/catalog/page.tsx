"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
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
        <CatalogState
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
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const worksQuery = useInfiniteQuery({
    queryKey: [
      "works",
      { search, kinds, yearFrom, yearTo, minRating, sortBy, sortOrder },
    ],
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

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage && hasNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="flex shrink-0 items-center gap-3" href="/">
            <Image
              src="/logo.svg"
              alt="Fictrio"
              width={36}
              height={36}
              priority
            />
            <span className="text-xl font-semibold text-primary">Fictrio</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex">
            <Link
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              href="/"
            >
              Лента
            </Link>
            <Link className="rounded-md px-3 py-2 text-primary" href="/catalog">
              Каталог
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              href="/lists"
            >
              Списки
            </Link>
            <a
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              href="#"
            >
              Профиль
            </a>
          </nav>
        </div>
      </header>

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

        <section className="mt-5 grid gap-4 rounded-md border bg-card p-4 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium">Поиск</span>
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                onChange={(event) =>
                  updateParams({ search: event.target.value })
                }
                placeholder="Название произведения"
                type="search"
                value={search}
              />
            </span>
          </label>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
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

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <label className="block">
                <span className="text-sm font-medium">Год от</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                  max={2100}
                  min={1800}
                  onChange={(event) =>
                    updateParams({ yearFrom: event.target.value })
                  }
                  placeholder="1990"
                  type="number"
                  value={yearFrom}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Год до</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                  max={2100}
                  min={1800}
                  onChange={(event) =>
                    updateParams({ yearTo: event.target.value })
                  }
                  placeholder="2026"
                  type="number"
                  value={yearTo}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Оценка от</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
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
              </label>
            </div>
          </div>

          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Сортировка</span>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                onChange={(event) =>
                  updateParams({ sortBy: event.target.value })
                }
                value={sortBy}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Порядок</span>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                onChange={(event) =>
                  updateParams({ sortOrder: event.target.value })
                }
                value={sortOrder}
              >
                {sortOrderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {worksQuery.isLoading ? (
          <CatalogState
            title="Загрузка каталога"
            text="Получаем произведения из API."
          />
        ) : null}

        {worksQuery.isError ? (
          <CatalogState
            title="Не удалось загрузить каталог"
            text={worksQuery.error.message}
          />
        ) : null}

        {!worksQuery.isLoading && !worksQuery.isError && items.length === 0 ? (
          <CatalogState
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
          <CatalogState
            title="Загружаем еще"
            text="Подбираем следующую порцию произведений."
          />
        ) : null}

        {hasNextPage && !isFetchingNextPage ? (
          <div className="mt-5 flex justify-center">
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition hover:border-primary hover:text-primary"
              onClick={() => void fetchNextPage()}
              type="button"
            >
              Загрузить еще
            </button>
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
    : "releaseYear";
}

function getSortOrder(searchParams: URLSearchParams) {
  const sortOrder = searchParams.get("sortOrder");

  return sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";
}

function CatalogState({ title, text }: { title: string; text: string }) {
  return (
    <section className="mt-5 rounded-md border bg-card p-8 text-center shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </section>
  );
}
