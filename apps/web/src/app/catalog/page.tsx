"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Film, Search, Tv } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import { getWorks, WorkKind, WorkListItem } from "@/features/works/works-api";

const kindOptions: Array<{ value: WorkKind | "all"; label: string }> = [
  { value: "all", label: "Все" },
  { value: "movie", label: "Фильмы" },
  { value: "show", label: "Сериалы" },
  { value: "book", label: "Книги" },
];

const kindLabels: Record<WorkKind, string> = {
  movie: "Фильм",
  show: "Сериал",
  book: "Книга",
};

const kindIcons = {
  movie: Film,
  show: Tv,
  book: BookOpen,
};

export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<WorkKind | "all">("all");
  const [year, setYear] = useState("");

  const worksQuery = useQuery({
    queryKey: ["works", { search, kind, year }],
    queryFn: () => getWorks({ search, kind, year }),
  });

  const items = worksQuery.data?.items ?? [];

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
            <a
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              href="#"
            >
              Списки
            </a>
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
            Найдено: {worksQuery.data?.total ?? 0}
          </p>
        </div>

        <section className="mt-5 grid gap-3 rounded-md border bg-card p-4 shadow-sm md:grid-cols-[minmax(220px,1fr)_180px_140px]">
          <label className="block">
            <span className="text-sm font-medium">Поиск</span>
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Название произведения"
                type="search"
                value={search}
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Тип</span>
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              onChange={(event) =>
                setKind(event.target.value as WorkKind | "all")
              }
              value={kind}
            >
              {kindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Год</span>
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              max={2100}
              min={1800}
              onChange={(event) => setYear(event.target.value)}
              placeholder="2024"
              type="number"
              value={year}
            />
          </label>
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
          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function WorkCard({ work }: { work: WorkListItem }) {
  const Icon = kindIcons[work.kind];
  const subtitle = [kindLabels[work.kind], work.releaseYear]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      className="group flex min-h-[260px] flex-col rounded-md border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md"
      href={`/catalog/${work.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        {work.imageUrl ? (
          <div
            aria-hidden="true"
            className="h-24 w-16 shrink-0 rounded-md bg-cover bg-center"
            style={{ backgroundImage: `url(${work.imageUrl})` }}
          />
        ) : (
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
            <Icon className="size-5" />
          </div>
        )}
        <div className="text-right">
          {work.rating.average === null ? (
            <p className="text-sm text-muted-foreground">Нет оценок</p>
          ) : (
            <div className="flex items-center gap-2">
              <RatingMark value={work.rating.average} size="sm" />
              <span className="text-sm font-medium text-primary">
                {work.rating.average.toFixed(1)}
              </span>
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {work.rating.count} оценок
          </p>
        </div>
      </div>
      <div className="mt-5 min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {subtitle}
        </p>
        <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-primary">
          {work.title}
        </h2>
        {work.originalTitle ? (
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {work.originalTitle}
          </p>
        ) : null}
        <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">
          {work.description ?? "Описание пока не добавлено."}
        </p>
      </div>
      <span className="mt-auto pt-5 text-sm font-medium text-primary group-hover:underline">
        Открыть карточку
      </span>
    </Link>
  );
}

function CatalogState({ title, text }: { title: string; text: string }) {
  return (
    <section className="mt-5 rounded-md border bg-card p-8 text-center shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </section>
  );
}
