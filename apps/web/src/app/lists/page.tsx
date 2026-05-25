"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
import { useAuthStore } from "@/features/auth/auth-store";
import { createList, getPublicLists } from "@/features/lists/lists-api";
import { ListCard } from "@/features/lists/list-card";

const pageSize = 12;

export default function ListsPage() {
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated, hydrate } = useAuthStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const listsQuery = useInfiniteQuery({
    queryKey: ["lists", "public"],
    queryFn: ({ pageParam }) => getPublicLists(pageParam, pageSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = (lastPage.offset ?? 0) + lastPage.items.length;

      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });
  const lists = useMemo(
    () => listsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listsQuery.data?.pages],
  );

  const createMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для создания списка нужно войти в аккаунт");
      }

      return createList(
        {
          title: title.trim(),
          description: description.trim() || null,
          visibility: "public",
        },
        accessToken,
      );
    },
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setMessage("Список создан");
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось создать список",
      );
    },
  });

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    createMutation.mutate();
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
            <Link
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              href="/catalog"
            >
              Каталог
            </Link>
            <Link className="rounded-md px-3 py-2 text-primary" href="/lists">
              Списки
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">
                Пользовательские списки
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Подборки фильмов, сериалов и книг от пользователей Fictrio.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Найдено: {listsQuery.data?.pages[0]?.total ?? 0}
            </p>
          </div>

          {listsQuery.isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Загружаем списки...
            </p>
          ) : null}
          {listsQuery.isError ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {listsQuery.error.message}
            </p>
          ) : null}
          {lists.length === 0 && !listsQuery.isLoading ? (
            <p className="mt-6 rounded-md border bg-card p-6 text-sm text-muted-foreground">
              Публичных списков пока нет. Создайте первый список для обсуждения.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4">
            {lists.map((list) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>

          {listsQuery.hasNextPage ? (
            <button
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-60"
              disabled={listsQuery.isFetchingNextPage}
              onClick={() => listsQuery.fetchNextPage()}
              type="button"
            >
              {listsQuery.isFetchingNextPage ? "Загрузка..." : "Показать еще"}
            </button>
          ) : null}
        </section>

        <aside>
          <section className="rounded-md border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Новый список</h2>
              <ListPlus className="size-4 text-primary" />
            </div>

            {!user && isHydrated ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Войдите на главной странице, чтобы создавать списки.
              </p>
            ) : null}

            {user ? (
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={handleCreateSubmit}
              >
                <label className="block">
                  <span className="text-sm font-medium">Название</span>
                  <input
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                    maxLength={255}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    value={title}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Описание</span>
                  <textarea
                    className="mt-1 min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                    maxLength={2000}
                    onChange={(event) => setDescription(event.target.value)}
                    value={description}
                  />
                </label>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-[var(--fictrio-accent)] disabled:opacity-60"
                  disabled={
                    title.trim().length === 0 || createMutation.isPending
                  }
                  type="submit"
                >
                  <ListPlus className="size-4" />
                  Создать
                </button>
              </form>
            ) : null}
            {message ? (
              <p className="mt-3 text-sm text-muted-foreground">{message}</p>
            ) : null}
          </section>
        </aside>
      </main>
    </div>
  );
}
