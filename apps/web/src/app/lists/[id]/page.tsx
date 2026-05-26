"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  deleteListRating,
  getList,
  rateList,
  removeWorkFromList,
  reorderListItems,
  updateList,
} from "@/features/lists/lists-api";
import { AverageRatingSummary } from "@/features/ratings/average-rating-summary";
import { RatingControl } from "@/features/ratings/rating-control";
import { WorkCard } from "@/features/works/work-card";
import { getWorksCountLabel } from "@/features/works/work-rail";

const listItemsPageSize = 12;

export default function ListDetailsPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated, hydrate } = useAuthStore();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [ratingDraft, setRatingDraft] = useState<
    number | null | undefined
  >();
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const listQuery = useInfiniteQuery({
    queryKey: ["list", params.id],
    queryFn: ({ pageParam }) =>
      getList(params.id, pageParam, listItemsPageSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce(
        (count, page) => count + page.items.length,
        0,
      );

      return loadedCount < lastPage.itemsTotal ? loadedCount : undefined;
    },
  });
  const list = listQuery.data?.pages[0];
  const isOwner = Boolean(user && list && user.id === list.owner.id);
  const ratingValue =
    ratingDraft === undefined ? (list?.userRating ?? 0) : (ratingDraft ?? 0);
  const hasRating =
    ratingDraft === undefined
      ? list?.userRating !== null && list?.userRating !== undefined
      : ratingDraft !== null;
  const fetchNextListItemsPage = listQuery.fetchNextPage;
  const hasNextListItemsPage = listQuery.hasNextPage;
  const isFetchingNextListItemsPage = listQuery.isFetchingNextPage;
  const canReorderItems = isOwner && !hasNextListItemsPage;
  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data?.pages],
  );

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasNextListItemsPage &&
          !isFetchingNextListItemsPage
        ) {
          void fetchNextListItemsPage();
        }
      },
      { rootMargin: "320px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [
    fetchNextListItemsPage,
    hasNextListItemsPage,
    isFetchingNextListItemsPage,
  ]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для редактирования списка нужно войти в аккаунт");
      }

      return updateList(
        params.id,
        {
          title: titleDraft,
          description: descriptionDraft || null,
        },
        accessToken,
      );
    },
    onSuccess: async () => {
      setIsEditingDetails(false);
      setMessage("Список обновлен");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["list", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
      ]);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось обновить список",
      );
    },
  });

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
      setRatingDraft(null);
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

  const removeMutation = useMutation({
    mutationFn: (workId: string) => {
      if (!accessToken) {
        throw new Error("Для удаления из списка нужно войти в аккаунт");
      }

      return removeWorkFromList(params.id, workId, accessToken);
    },
    onSuccess: async () => {
      setMessage("Произведение удалено из списка");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["list", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
      ]);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error
          ? error.message
          : "Не удалось удалить произведение",
      );
    },
  });

  function startEditingDetails() {
    if (!list) {
      return;
    }

    setTitleDraft(list.title);
    setDescriptionDraft(list.description ?? "");
    setMessage(null);
    setIsEditingDetails(true);
  }

  function cancelEditingDetails() {
    setIsEditingDetails(false);
    setMessage(null);
  }

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
              <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
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

                    {isEditingDetails ? (
                      <form
                        className="mt-4 max-w-3xl"
                        id="list-details-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          updateMutation.mutate();
                        }}
                      >
                        <label className="block text-sm font-medium">
                          Название
                          <input
                            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
                            disabled={updateMutation.isPending}
                            maxLength={255}
                            onChange={(event) =>
                              setTitleDraft(event.target.value)
                            }
                            required
                            type="text"
                            value={titleDraft}
                          />
                        </label>
                      </form>
                    ) : (
                      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-semibold text-primary">
                          {list.title}
                        </h1>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">
                          {list.itemsTotal}{" "}
                          {getWorksCountLabel(list.itemsTotal)}
                        </span>
                        {isOwner ? (
                          <button
                            className="grid size-8 place-items-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary"
                            onClick={startEditingDetails}
                            type="button"
                          >
                            <Pencil className="size-4" />
                            <span className="sr-only">
                              Редактировать список
                            </span>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </header>

                  {isEditingDetails ? (
                    <div className="mt-4 max-w-3xl space-y-3">
                      <label className="block text-sm font-medium">
                        Описание
                        <textarea
                          className="mt-1 min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
                          disabled={updateMutation.isPending}
                          form="list-details-form"
                          maxLength={2000}
                          onChange={(event) =>
                            setDescriptionDraft(event.target.value)
                          }
                          value={descriptionDraft}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-accent disabled:opacity-50"
                          disabled={updateMutation.isPending}
                          form="list-details-form"
                          type="submit"
                        >
                          <Save className="size-4" />
                          Сохранить
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                          disabled={updateMutation.isPending}
                          onClick={cancelEditingDetails}
                          type="button"
                        >
                          <X className="size-4" />
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : list.description ? (
                    <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6">
                      {list.description}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Описание пока не добавлено.
                    </p>
                  )}
                </div>

                <aside className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                  <AverageRatingSummary
                    className="self-start md:self-end"
                    average={list.rating.average}
                    count={list.rating.count}
                  />
                  <RatingControl
                    value={ratingValue}
                    hasValue={hasRating}
                    disabled={!isHydrated || !user || ratingMutation.isPending}
                    deleteDisabled={!user || deleteRatingMutation.isPending}
                    onChange={() => {
                      ratingMutation.mutate((Math.floor(ratingValue) + 1) % 4);
                    }}
                    onDelete={() => {
                      deleteRatingMutation.mutate();
                    }}
                  />
                </aside>
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
                          disabled={
                            !canReorderItems ||
                            index === 0 ||
                            reorderMutation.isPending
                          }
                          onClick={() => moveItem(index, -1)}
                          type="button"
                        >
                          <ArrowUp className="size-4" />
                          <span className="sr-only">Выше</span>
                        </button>
                        <button
                          className="grid size-9 place-items-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                          disabled={
                            !canReorderItems ||
                            index === items.length - 1 ||
                            reorderMutation.isPending
                          }
                          onClick={() => moveItem(index, 1)}
                          type="button"
                        >
                          <ArrowDown className="size-4" />
                          <span className="sr-only">Ниже</span>
                        </button>
                        <button
                          className="grid size-9 place-items-center rounded-md border text-muted-foreground transition hover:border-destructive hover:text-destructive disabled:opacity-50"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(item.work.id)}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">
                            Удалить из списка
                          </span>
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

              <div ref={loadMoreRef} className="h-8" />
              {isFetchingNextListItemsPage ? (
                <p className="text-sm text-muted-foreground">
                  Загружаем еще...
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
