"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { formatDate } from "@/lib/format";
import { AddToListPanel } from "@/features/lists/add-to-list-panel";
import { WorkReviews } from "@/features/posts/work-reviews";
import { AverageRatingSummary } from "@/features/ratings/average-rating-summary";
import { WorkRail } from "@/features/works/work-rail";
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
      <SiteHeader back={{ href: "/catalog", label: "Каталог" }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {workQuery.isLoading ? (
          <StateCard
            as="h1"
            title="Загрузка карточки"
            text="Получаем данные произведения из API."
          />
        ) : null}

        {workQuery.isError ? (
          <StateCard
            as="h1"
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
                  <AverageRatingSummary
                    average={workQuery.data.rating.average}
                    count={workQuery.data.rating.count}
                    onClick={() => {
                      document
                        .getElementById("work-review-form")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
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

            <AddToListPanel workId={workQuery.data.id} />
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
