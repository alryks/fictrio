"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/form-field";
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
    <Card className="mt-6 p-4">
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
            <FormField label="Ваш список">
              {(field) => (
                <Select
                  value={selectedListId}
                  onValueChange={setSelectedListId}
                  disabled={myListsQuery.isLoading || addMutation.isPending}
                >
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder="Выберите список" />
                  </SelectTrigger>
                  <SelectContent>
                    {myListsQuery.data?.items.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <Button
              variant="outline"
              className="h-10"
              disabled={!selectedListId || addMutation.isPending}
              type="submit"
            >
              <ListPlus className="size-4" />
              Добавить
            </Button>
          </form>

          <form className="flex flex-col gap-3" onSubmit={handleCreateSubmit}>
            <FormField label="Новый список">
              {(field) => (
                <Input
                  {...field}
                  maxLength={255}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например, Лучшее на выходные"
                  value={title}
                />
              )}
            </FormField>
            <Button
              className="h-10"
              disabled={
                title.trim().length === 0 || createAndAddMutation.isPending
              }
              type="submit"
            >
              <ListPlus className="size-4" />
              Создать и добавить
            </Button>
          </form>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      ) : null}
    </Card>
  );
}
