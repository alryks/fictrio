"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { PosterPlaceholder } from "@/components/poster-placeholder";
import { StateCard } from "@/components/state-card";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { isAdmin } from "@/lib/roles";
import { useSession } from "@/features/auth/use-session";
import { AddToListPanel } from "@/features/lists/add-to-list-panel";
import { WorkReviews } from "@/features/posts/work-reviews";
import { WorkProgressPanel } from "@/features/progress/work-progress-panel";
import { AverageRatingSummary } from "@/features/ratings/average-rating-summary";
import { WorkRail } from "@/features/works/work-rail";
import {
  deleteWork,
  getWork,
  updateWork,
  WorkKind,
} from "@/features/works/works-api";

const kindLabels: Record<WorkKind, string> = {
  movie: "Фильм",
  show: "Сериал",
  season: "Сезон",
  episode: "Эпизод",
  book: "Книга",
};

export default function WorkDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const canAdminister = isAdmin(user);
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [originalTitleDraft, setOriginalTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const workQuery = useQuery({
    queryKey: qk.works.detail(params.id),
    queryFn: () => getWork(params.id),
  });
  const work = workQuery.data;

  const updateMutation = useMutation({
    mutationFn: () =>
      updateWork(params.id, {
        title: titleDraft,
        originalTitle: originalTitleDraft.trim() ? originalTitleDraft : null,
        description: descriptionDraft.trim() ? descriptionDraft : null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.works.detail(params.id) }),
        queryClient.invalidateQueries({ queryKey: qk.works.all }),
        queryClient.invalidateQueries({ queryKey: qk.lists.all }),
      ]);
      setIsEditing(false);
      setFieldErrors({});
      toast.success("Произведение обновлено");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.issues.length > 0) {
        setFieldErrors(
          Object.fromEntries(
            error.issues.map((issue) => [issue.path, issue.message]),
          ),
        );
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось обновить произведение",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWork(params.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.works.all }),
        queryClient.invalidateQueries({ queryKey: qk.lists.all }),
      ]);
      toast.success("Произведение удалено");
      router.push("/catalog");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось удалить произведение",
      );
    },
  });

  function startEditing() {
    if (!work) {
      return;
    }

    setTitleDraft(work.title);
    setOriginalTitleDraft(work.originalTitle ?? "");
    setDescriptionDraft(work.description ?? "");
    setFieldErrors({});
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setFieldErrors({});
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    updateMutation.mutate();
  }

  function handleDelete() {
    if (
      window.confirm(
        "Удалить это произведение вместе со всеми оценками и отзывами? Действие необратимо.",
      )
    ) {
      deleteMutation.mutate();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader active="catalog" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {workQuery.isLoading ? (
          <div className="grid gap-6 rounded-md border bg-card p-5 shadow-sm md:grid-cols-[240px_minmax(0,1fr)]">
            <Skeleton className="aspect-[2/3] w-full" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full max-w-sm" />
            </div>
          </div>
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
                {isEditing ? (
                  <form
                    id="work-details-form"
                    className="max-w-3xl space-y-4"
                    onSubmit={handleSubmit}
                  >
                    <FormField label="Название" error={fieldErrors.title}>
                      {(field) => (
                        <Input
                          {...field}
                          disabled={updateMutation.isPending}
                          maxLength={255}
                          onChange={(event) =>
                            setTitleDraft(event.target.value)
                          }
                          required
                          value={titleDraft}
                        />
                      )}
                    </FormField>
                    <FormField
                      label="Оригинальное название"
                      error={fieldErrors.originalTitle}
                    >
                      {(field) => (
                        <Input
                          {...field}
                          disabled={updateMutation.isPending}
                          maxLength={255}
                          onChange={(event) =>
                            setOriginalTitleDraft(event.target.value)
                          }
                          value={originalTitleDraft}
                        />
                      )}
                    </FormField>
                    <FormField
                      label="Описание"
                      error={fieldErrors.description}
                    >
                      {(field) => (
                        <Textarea
                          {...field}
                          className="min-h-32"
                          disabled={updateMutation.isPending}
                          maxLength={5000}
                          onChange={(event) =>
                            setDescriptionDraft(event.target.value)
                          }
                          value={descriptionDraft}
                        />
                      )}
                    </FormField>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={updateMutation.isPending}
                          type="submit"
                        >
                          <Save className="size-4" />
                          Сохранить
                        </Button>
                        <Button
                          variant="outline"
                          disabled={updateMutation.isPending}
                          onClick={cancelEditing}
                          type="button"
                        >
                          <X className="size-4" />
                          Отмена
                        </Button>
                      </div>
                      <Button
                        variant="destructive"
                        disabled={
                          updateMutation.isPending || deleteMutation.isPending
                        }
                        onClick={handleDelete}
                        type="button"
                      >
                        <Trash2 className="size-4" />
                        Удалить произведение
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">
                      {kindLabels[workQuery.data.kind]}
                      {workQuery.data.releaseYear
                        ? ` · ${workQuery.data.releaseYear}`
                        : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-3xl font-semibold text-primary">
                            {workQuery.data.title}
                          </h1>
                          {canAdminister ? (
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8"
                              onClick={startEditing}
                              type="button"
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">
                                Редактировать произведение
                              </span>
                            </Button>
                          ) : null}
                        </div>
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
                      {workQuery.data.description ??
                        "Описание пока не добавлено."}
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
                  </>
                )}
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

            <WorkProgressPanel work={workQuery.data} />
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
    <PosterPlaceholder
      imageUrl={imageUrl}
      className="relative aspect-[2/3] overflow-hidden rounded-md"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(24,24,36,0.12),transparent_58%)]" />
    </PosterPlaceholder>
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
    pages: "Страниц",
  };

  return labels[key] ?? key;
}

function formatMetaValue(key: string, value: string | number) {
  if (key === "runtimeMinutes") {
    return `${value} мин.`;
  }

  if (key === "pages") {
    return `${value} стр.`;
  }

  if (key === "firstAirDate" || key === "lastAirDate" || key === "airDate") {
    return formatDate(String(value));
  }

  return String(value);
}
