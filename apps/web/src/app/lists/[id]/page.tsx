"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Save, Trash2, X } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { UserBadge } from "@/components/user-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { formatDate, getWorksCountLabel } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import { useSession } from "@/features/auth/use-session";
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

const listItemsPageSize = 12;

function requireUser(user: unknown, action: string): asserts user {
  if (!user) {
    throw new Error(`Для ${action} нужно войти в аккаунт`);
  }
}

export default function ListDetailsPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, isLoading } = useSession();
  const [ratingDraft, setRatingDraft] = useState<
    number | null | undefined
  >();
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const listQuery = useInfiniteQuery({
    queryKey: qk.lists.detail(params.id),
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
  const hasNextListItemsPage = listQuery.hasNextPage;
  const isFetchingNextListItemsPage = listQuery.isFetchingNextPage;
  const canReorderItems = isOwner && !hasNextListItemsPage;
  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data?.pages],
  );

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: hasNextListItemsPage,
    isFetchingNextPage: isFetchingNextListItemsPage,
    fetchNextPage: listQuery.fetchNextPage,
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      requireUser(user, "редактирования списка");
      return updateList(params.id, {
        title: titleDraft,
        description: descriptionDraft || null,
      });
    },
    onSuccess: async () => {
      setIsEditingDetails(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.lists.detail(params.id) }),
        queryClient.invalidateQueries({ queryKey: qk.lists.all }),
      ]);
    },
  });

  const ratingMutation = useMutation({
    mutationFn: (value: number) => {
      requireUser(user, "оценки списка");
      return rateList(params.id, value);
    },
    onSuccess: async (response) => {
      setRatingDraft(response.value);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.lists.detail(params.id) }),
        queryClient.invalidateQueries({ queryKey: qk.lists.all }),
      ]);
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: () => {
      requireUser(user, "удаления оценки");
      return deleteListRating(params.id);
    },
    onSuccess: async () => {
      setRatingDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.lists.detail(params.id) }),
        queryClient.invalidateQueries({ queryKey: qk.lists.all }),
      ]);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (nextItems: Array<{ workId: string; position: number }>) => {
      requireUser(user, "изменения порядка");
      return reorderListItems(params.id, nextItems);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.lists.detail(params.id) });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (workId: string) => {
      requireUser(user, "удаления из списка");
      return removeWorkFromList(params.id, workId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.lists.detail(params.id) }),
        queryClient.invalidateQueries({ queryKey: qk.lists.all }),
      ]);
    },
  });

  function startEditingDetails() {
    if (!list) {
      return;
    }

    setTitleDraft(list.title);
    setDescriptionDraft(list.description ?? "");
    setIsEditingDetails(true);
  }

  function cancelEditingDetails() {
    setIsEditingDetails(false);
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
      <SiteHeader active="lists" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {listQuery.isLoading ? (
          <StateCard as="h1" title="Загрузка списка" text="Получаем подборку из API." />
        ) : null}
        {listQuery.isError ? (
          <StateCard as="h1" title="Список недоступен" text={listQuery.error.message} />
        ) : null}

        {list ? (
          <>
            <section className="rounded-md border bg-card p-5 shadow-sm">
              <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <header className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserBadge name={list.owner.username} />
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
                        <FormField label="Название">
                          {(field) => (
                            <Input
                              {...field}
                              disabled={updateMutation.isPending}
                              maxLength={255}
                              onChange={(event) =>
                                setTitleDraft(event.target.value)
                              }
                              required
                              type="text"
                              value={titleDraft}
                            />
                          )}
                        </FormField>
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
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={startEditingDetails}
                            type="button"
                          >
                            <Pencil className="size-4" />
                            <span className="sr-only">
                              Редактировать список
                            </span>
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </header>

                  {isEditingDetails ? (
                    <div className="mt-4 max-w-3xl space-y-3">
                      <FormField label="Описание">
                        {(field) => (
                          <Textarea
                            {...field}
                            className="min-h-28"
                            disabled={updateMutation.isPending}
                            form="list-details-form"
                            maxLength={2000}
                            onChange={(event) =>
                              setDescriptionDraft(event.target.value)
                            }
                            value={descriptionDraft}
                          />
                        )}
                      </FormField>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={updateMutation.isPending}
                          form="list-details-form"
                          type="submit"
                        >
                          <Save className="size-4" />
                          Сохранить
                        </Button>
                        <Button
                          variant="outline"
                          disabled={updateMutation.isPending}
                          onClick={cancelEditingDetails}
                          type="button"
                        >
                          <X className="size-4" />
                          Отмена
                        </Button>
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
                    disabled={isLoading || !user || ratingMutation.isPending}
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
            </section>

            <section className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item, index) => (
                  <div key={item.work.id}>
                    <WorkCard work={item.work} />
                    {isOwner ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9"
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
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9"
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
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="size-9"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(item.work.id)}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Удалить из списка</span>
                        </Button>
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
