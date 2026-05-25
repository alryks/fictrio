"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowDown, ArrowUp } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  getList,
  rateList,
  reorderListItems,
} from "@/features/lists/lists-api";
import { WorkCard } from "@/features/works/work-card";
import { getWorksCountLabel } from "@/features/works/work-rail";

export default function ListDetailsPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated, hydrate } = useAuthStore();
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
  const ratingValue = list?.userRating ?? list?.rating.average ?? 0;
  const items = useMemo(() => list?.items ?? [], [list?.items]);

  const ratingMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для оценки списка нужно войти в аккаунт");
      }

      return rateList(
        params.id,
        (Math.floor(ratingValue) + 1) % 4,
        accessToken,
      );
    },
    onSuccess: async () => {
      setMessage("Оценка списка сохранена");
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
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    @{list.owner.username} · {list.items.length}{" "}
                    {getWorksCountLabel(list.items.length)}
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold text-primary">
                    {list.title}
                  </h1>
                  {list.description ? (
                    <p className="mt-4 max-w-3xl whitespace-pre-wrap leading-7">
                      {list.description}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label="Оценить список"
                  className="flex shrink-0 items-center gap-3 rounded-md border bg-background px-4 py-3 text-left transition hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
                  disabled={!isHydrated || !user || ratingMutation.isPending}
                  onClick={() => {
                    setMessage(null);
                    ratingMutation.mutate();
                  }}
                  type="button"
                >
                  <RatingMark value={ratingValue} size="lg" />
                  <div className="text-right">
                    <p className="text-xl font-semibold text-primary">
                      {(list.rating.average ?? 0).toFixed(1)}/3.0
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {list.rating.count} шт.
                    </p>
                  </div>
                </button>
              </div>
              {message ? (
                <p className="mt-4 text-sm text-muted-foreground">{message}</p>
              ) : null}
            </section>

            <section className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item, index) => (
                  <div
                    key={item.work.id}
                    className="rounded-md border bg-card p-3"
                  >
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
