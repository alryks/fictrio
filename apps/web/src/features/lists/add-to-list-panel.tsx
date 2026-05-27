"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
import { useAuthStore } from "@/features/auth/auth-store";
import { addWorkToList, createList, getMyLists } from "./lists-api";

type AddToListPanelProps = {
  workId: string;
};

function requireUser(user: unknown, action: string): asserts user {
  if (!user) {
    throw new Error(`Для ${action} нужно войти в аккаунт`);
  }
}

export function AddToListPanel({ workId }: AddToListPanelProps) {
  const queryClient = useQueryClient();
  const { user, isHydrated } = useAuthStore();
  const [selectedListId, setSelectedListId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const myListsQuery = useQuery({
    queryKey: ["lists", "mine"],
    queryFn: getMyLists,
    enabled: Boolean(user),
  });

  const addMutation = useMutation({
    mutationFn: (listId: string) => {
      requireUser(user, "добавления в список");
      return addWorkToList(listId, workId);
    },
    onSuccess: async () => {
      setMessage("Произведение добавлено в список");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
        queryClient.invalidateQueries({ queryKey: ["lists", "mine"] }),
      ]);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error
          ? error.message
          : "Не удалось добавить произведение",
      );
    },
  });

  const createAndAddMutation = useMutation({
    mutationFn: async () => {
      requireUser(user, "создания списка");
      const list = await createList({
        title: title.trim(),
        visibility: "public",
      });
      return addWorkToList(list.id, workId);
    },
    onSuccess: async (list) => {
      setTitle("");
      setSelectedListId(list.id);
      setMessage("Список создан, произведение добавлено");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
        queryClient.invalidateQueries({ queryKey: ["lists", "mine"] }),
      ]);
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось создать список",
      );
    },
  });

  function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (selectedListId) {
      addMutation.mutate(selectedListId);
    }
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    createAndAddMutation.mutate();
  }

  return (
    <section className="mt-6 rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <ListPlus className="size-5 shrink-0 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Добавить в список</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Собирайте подборки произведений для публичного обсуждения.
          </p>
        </div>
      </div>

      {!user && isHydrated ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Войдите в аккаунт на главной странице, чтобы создавать списки.
        </p>
      ) : null}

      {user ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <form className="flex flex-col gap-3" onSubmit={handleAddSubmit}>
            <label className="block">
              <span className="text-sm font-medium">Ваш список</span>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                disabled={myListsQuery.isLoading || addMutation.isPending}
                onChange={(event) => setSelectedListId(event.target.value)}
                value={selectedListId}
              >
                <option value="">Выберите список</option>
                {myListsQuery.data?.items.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-60"
              disabled={!selectedListId || addMutation.isPending}
              type="submit"
            >
              <ListPlus className="size-4" />
              Добавить
            </button>
          </form>

          <form className="flex flex-col gap-3" onSubmit={handleCreateSubmit}>
            <label className="block">
              <span className="text-sm font-medium">Новый список</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                maxLength={255}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например, Лучшее на выходные"
                value={title}
              />
            </label>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-[var(--fictrio-accent)] disabled:opacity-60"
              disabled={
                title.trim().length === 0 || createAndAddMutation.isPending
              }
              type="submit"
            >
              <ListPlus className="size-4" />
              Создать и добавить
            </button>
          </form>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      ) : null}
    </section>
  );
}
