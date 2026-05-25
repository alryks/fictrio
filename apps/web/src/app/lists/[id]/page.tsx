"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowDown, ArrowUp } from "lucide-react";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  deleteListRating,
  getList,
  rateList,
  reorderListItems,
} from "@/features/lists/lists-api";
import { AverageRatingSummary } from "@/features/ratings/average-rating-summary";
import { RatingControl } from "@/features/ratings/rating-control";
import { WorkCard } from "@/features/works/work-card";
import { getWorksCountLabel } from "@/features/works/work-rail";

export default function ListDetailsPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated, hydrate } = useAuthStore();
  const [ratingDraft, setRatingDraft] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const listQuery = useQuery({
    queryKey: ["list", params.id],
    queryFn: () => getList(params.id),
  });
  const list = listQuery.data;
  const isOwner = Boolean(user && list && user.id === list.owner.id);
  const ratingValue = ratingDraft ?? list?.userRating ?? 0;
  const items = useMemo(() => list?.items ?? [], [list?.items]);

  const ratingMutation = useMutation({
    mutationFn: (value: number) => {
      if (!accessToken) {
        throw new Error("Для оценки списка нужно войти в аккаунт");
      }

      return rateList(params.id, value, accessToken);
    },
    onSuccess: async (response) => {
      setRatingDraft(response.value);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["list", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
      ]);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось оценить список",
      );
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для удаления оценки нужно войти в аккаунт");
      }

      return deleteListRating(params.id, accessToken);
    },
    onSuccess: async () => {
      setRatingDraft(0);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["list", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
      ]);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось удалить оценку",
      );
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (nextItems: Array<{ workId: string; position: number }>) => {
      if (!accessToken) {
        throw new Error("Для изменения порядка нужно войти в аккаунт");
      }

      return reorderListItems(params.id, nextItems, accessToken);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["list", params.id] });
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось изменить порядок",
      );
    },
  });

  function moveItem(index: number, direction: -1 | 1) {
    const next = [...items];
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= next.length) {
      return;
    }

    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    reorderMutation.mutate(
      next.map((item, itemIndex) => ({
        workId: item.work.id,
        position: itemIndex,
      })),
    );
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
          <Link
            className="ml-auto inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
            href="/lists"
          >
            <ArrowLeft className="size-4" />
            Списки
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {listQuery.isLoading ? (
          <State title="Загрузка списка" text="Получаем подборку из API." />
        ) : null}
        {listQuery.isError ? (
          <State title="Список недоступен" text={listQuery.error.message} />
        ) : null}

        {list ? (
          <>
            <section className="rounded-md border bg-card p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <header className="min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
                      {list.owner.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {list.owner.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{list.owner.username} · {formatDate(list.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold text-primary">
                      {list.title}
                    </h1>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">
                      {list.items.length}{" "}
                      {getWorksCountLabel(list.items.length)}
                    </span>
                  </div>
                </header>

                <AverageRatingSummary
                  average={list.rating.average}
                  count={list.rating.count}
                />

                <div className="min-w-0">
                  {list.description ? (
                    <p className="max-w-3xl whitespace-pre-wrap text-sm leading-6">
                      {list.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Описание пока не добавлено.
                    </p>
                  )}
                </div>

                <RatingControl
                  value={ratingValue}
                  disabled={!isHydrated || !user || ratingMutation.isPending}
                  deleteDisabled={!user || deleteRatingMutation.isPending}
                  onChange={() => {
                    ratingMutation.mutate((Math.floor(ratingValue) + 1) % 4);
                  }}
                  onDelete={() => {
                    deleteRatingMutation.mutate();
                  }}
                />
              </div>
              {message ? (
                <p className="mt-4 text-sm text-muted-foreground">{message}</p>
              ) : null}
            </section>

            <section className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item, index) => (
                  <div key={item.work.id}>
                    <WorkCard work={item.work} />
                    {isOwner ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          className="grid size-9 place-items-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                          disabled={index === 0 || reorderMutation.isPending}
                          onClick={() => moveItem(index, -1)}
                          type="button"
                        >
                          <ArrowUp className="size-4" />
                          <span className="sr-only">Выше</span>
                        </button>
                        <button
                          className="grid size-9 place-items-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                          disabled={
                            index === items.length - 1 ||
                            reorderMutation.isPending
                          }
                          onClick={() => moveItem(index, 1)}
                          type="button"
                        >
                          <ArrowDown className="size-4" />
                          <span className="sr-only">Ниже</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {items.length === 0 ? (
                <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
                  В этом списке пока нет произведений.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function State({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-md border bg-card p-8 text-center shadow-sm">
      <h1 className="font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </section>
  );
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
