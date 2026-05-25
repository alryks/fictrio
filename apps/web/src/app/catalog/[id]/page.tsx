"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";
import { RatingMark } from "@/components/ui/rating-mark";
import { WorkReviews } from "@/features/posts/work-reviews";
import { WorkCard } from "@/features/works/work-card";
import { getWork, WorkKind } from "@/features/works/works-api";

const kindLabels: Record<WorkKind, string> = {
  movie: "Фильм",
  show: "Сериал",
  season: "Сезон",
  episode: "Эпизод",
  book: "Книга",
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
          <>
            <article className="grid gap-6 rounded-md border bg-card p-5 shadow-sm md:grid-cols-[240px_minmax(0,1fr)]">
              <Poster imageUrl={workQuery.data.imageUrl} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  {kindLabels[workQuery.data.kind]}
                  {workQuery.data.releaseYear
                    ? ` · ${workQuery.data.releaseYear}`
                    : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-3xl font-semibold text-primary">
                      {workQuery.data.title}
                    </h1>
                    {workQuery.data.originalTitle ? (
                      <p className="mt-1 text-muted-foreground">
                        {workQuery.data.originalTitle}
                      </p>
                    ) : null}
                  </div>
                  <WorkRatingSummary
                    average={workQuery.data.rating.average}
                    count={workQuery.data.rating.count}
                  />
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
                          {formatMetaValue(key, value)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </div>

              {workQuery.data.kind === "show" &&
              workQuery.data.seasons?.length ? (
                <div className="md:col-span-2">
                  <WorkRail title="Сезоны" works={workQuery.data.seasons} />
                  <div className="mt-8 space-y-8">
                    {workQuery.data.seasons.map((season) =>
                      season.episodes.length ? (
                        <WorkRail
                          key={season.id}
                          title={season.title}
                          works={season.episodes}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              ) : null}

              {workQuery.data.kind === "season" &&
              workQuery.data.episodes?.length ? (
                <div className="md:col-span-2">
                  <WorkRail title="Эпизоды" works={workQuery.data.episodes} />
                </div>
              ) : null}
            </article>

            <WorkReviews work={workQuery.data} />
          </>
        ) : null}
      </main>
    </div>
  );
}

function Poster({ imageUrl }: { imageUrl: string | null }) {
  return (
    <div
      className="relative aspect-[2/3] overflow-hidden rounded-md bg-linear-to-br from-[#3838a8] via-[#6666cc] to-[#9f9fdf] bg-cover bg-center"
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(24,24,36,0.12),transparent_58%)]" />
    </div>
  );
}

function WorkRatingSummary({
  average,
  count,
}: {
  average: number | null;
  count: number;
}) {
  function scrollToReviewForm() {
    document.getElementById("work-review-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  if (average === null) {
    return (
      <button
        aria-label="Перейти к отзыву"
        className="flex shrink-0 items-center gap-3 rounded-md border bg-background px-4 py-3 text-left transition hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={scrollToReviewForm}
        type="button"
      >
        <RatingMark value={0} size="lg" />
        <div className="text-right">
          <p className="text-xl font-semibold text-primary">0.0/3.0</p>
          <p className="text-xs text-muted-foreground">0 шт.</p>
        </div>
      </button>
    );
  }

  return (
    <button
      aria-label="Перейти к отзыву"
      className="flex shrink-0 items-center gap-3 rounded-md border bg-background px-4 py-3 text-left transition hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={scrollToReviewForm}
      type="button"
    >
      <RatingMark value={average} size="lg" />
      <div className="text-right">
        <p className="text-xl font-semibold text-primary">
          {average.toFixed(1)}/3.0
        </p>
        <p className="text-xs text-muted-foreground">{count} шт.</p>
      </div>
    </button>
  );
}

function WorkRail({
  title,
  works,
}: {
  title: string;
  works: Array<ComponentProps<typeof WorkCard>["work"]>;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {works.length} {getWorksCountLabel(works.length)}
        </span>
      </div>
      <div className="-mx-5 mt-4 flex gap-4 overflow-x-auto px-5 pb-3">
        {works.map((work) => (
          <div key={work.id} className="w-40 shrink-0 sm:w-44">
            <WorkCard work={work} />
          </div>
        ))}
      </div>
    </section>
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
    seasonNumber: "Номер сезона",
    episodeNumber: "Номер эпизода",
    airDate: "Дата выхода",
    firstPublishYear: "Первый год публикации",
    authorNames: "Авторы",
  };

  return labels[key] ?? key;
}

function formatMetaValue(key: string, value: string | number) {
  if (key === "runtimeMinutes") {
    return `${value} мин.`;
  }

  if (key === "firstAirDate" || key === "lastAirDate" || key === "airDate") {
    return formatDate(String(value));
  }

  return String(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getWorksCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "элемент";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "элемента";
  }

  return "элементов";
}
