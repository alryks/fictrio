"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Film, Tv } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import { getWork, WorkKind } from "@/features/works/works-api";

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

export default function WorkDetailsPage() {
  const params = useParams<{ id: string }>();
  const workQuery = useQuery({
    queryKey: ["work", params.id],
    queryFn: () => getWork(params.id),
  });

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
          <Link
            className="ml-auto inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
            href="/catalog"
          >
            <ArrowLeft className="size-4" />
            Каталог
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {workQuery.isLoading ? (
          <DetailsState
            title="Загрузка карточки"
            text="Получаем данные произведения из API."
          />
        ) : null}

        {workQuery.isError ? (
          <DetailsState
            title="Карточка недоступна"
            text={workQuery.error.message}
          />
        ) : null}

        {workQuery.data ? (
          <article className="grid gap-6 rounded-md border bg-card p-5 shadow-sm md:grid-cols-[240px_minmax(0,1fr)]">
            <Poster
              imageUrl={workQuery.data.imageUrl}
              kind={workQuery.data.kind}
              title={workQuery.data.title}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                {kindLabels[workQuery.data.kind]}
                {workQuery.data.releaseYear
                  ? ` · ${workQuery.data.releaseYear}`
                  : ""}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-primary">
                {workQuery.data.title}
              </h1>
              {workQuery.data.originalTitle ? (
                <p className="mt-1 text-muted-foreground">
                  {workQuery.data.originalTitle}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {workQuery.data.rating.average === null ? (
                  <span className="text-sm text-muted-foreground">
                    Оценок пока нет
                  </span>
                ) : (
                  <>
                    <RatingMark
                      value={workQuery.data.rating.average}
                      size="lg"
                    />
                    <span className="text-lg font-semibold text-primary">
                      {workQuery.data.rating.average.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {workQuery.data.rating.count} оценок
                    </span>
                  </>
                )}
              </div>

              <p className="mt-6 max-w-3xl text-base leading-7">
                {workQuery.data.description ?? "Описание пока не добавлено."}
              </p>

              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                {Object.entries(workQuery.data.meta).map(([key, value]) =>
                  value === null ? null : (
                    <div
                      key={key}
                      className="rounded-md border bg-background p-3"
                    >
                      <dt className="text-xs uppercase text-muted-foreground">
                        {getMetaLabel(key)}
                      </dt>
                      <dd className="mt-1 text-sm font-medium">
                        {String(value)}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
}

function Poster({
  imageUrl,
  kind,
  title,
}: {
  imageUrl: string | null;
  kind: WorkKind;
  title: string;
}) {
  const Icon = kindIcons[kind];

  return (
    <div
      className="relative aspect-[2/3] overflow-hidden rounded-md bg-linear-to-br from-[#3838a8] via-[#6666cc] to-[#9f9fdf] bg-cover bg-center"
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(24,24,36,0.76),transparent_58%)]" />
      <Icon className="absolute right-4 top-4 size-7 text-white/80" />
      <p className="absolute inset-x-0 bottom-0 p-5 text-xl font-semibold leading-7 text-white">
        {title}
      </p>
    </div>
  );
}

function DetailsState({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-md border bg-card p-8 text-center shadow-sm">
      <h1 className="font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </section>
  );
}

function getMetaLabel(key: string) {
  const labels: Record<string, string> = {
    runtimeMinutes: "Длительность",
    directorNames: "Режиссеры",
    actorNames: "Актеры",
    firstAirDate: "Дата первой серии",
    lastAirDate: "Дата последней серии",
    creatorNames: "Создатели",
    firstPublishYear: "Первый год публикации",
    authorNames: "Авторы",
  };

  return labels[key] ?? key;
}
