"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { isAdmin } from "@/lib/roles";
import { useSession } from "@/features/auth/use-session";
import { deleteWork, updateWork, type WorkDetails } from "./works-api";

type FieldErrors = Record<string, string>;

/**
 * Administrator-only panel on a work card: edit the title, original title and
 * description, or delete the work entirely. Renders nothing for everyone else.
 */
export function WorkAdminControls({ work }: { work: WorkDetails }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(work.title);
  const [originalTitle, setOriginalTitle] = useState(work.originalTitle ?? "");
  const [description, setDescription] = useState(work.description ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const updateMutation = useMutation({
    mutationFn: () =>
      updateWork(work.id, {
        title,
        originalTitle: originalTitle.trim() ? originalTitle : null,
        description: description.trim() ? description : null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.works.detail(work.id) }),
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
    mutationFn: () => deleteWork(work.id),
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

  if (!isAdmin(user)) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    updateMutation.mutate();
  }

  function startEditing() {
    setTitle(work.title);
    setOriginalTitle(work.originalTitle ?? "");
    setDescription(work.description ?? "");
    setFieldErrors({});
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setFieldErrors({});
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
    <Card className="mt-6 border-dashed">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            Управление произведением
          </CardTitle>
          {isEditing ? null : (
            <Button variant="outline" onClick={startEditing} type="button">
              <Pencil data-icon="inline-start" />
              Редактировать
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form
            className="flex max-w-2xl flex-col gap-4"
            onSubmit={handleSubmit}
          >
            <FormField label="Название" error={fieldErrors.title}>
              {(field) => (
                <Input
                  {...field}
                  disabled={updateMutation.isPending}
                  maxLength={255}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  value={title}
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
                  onChange={(event) => setOriginalTitle(event.target.value)}
                  value={originalTitle}
                />
              )}
            </FormField>
            <FormField label="Описание" error={fieldErrors.description}>
              {(field) => (
                <Textarea
                  {...field}
                  className="min-h-32"
                  disabled={updateMutation.isPending}
                  maxLength={5000}
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              )}
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button disabled={updateMutation.isPending} type="submit">
                <Save data-icon="inline-start" />
                Сохранить
              </Button>
              <Button
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={cancelEditing}
                type="button"
              >
                <X data-icon="inline-start" />
                Отмена
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
                type="button"
              >
                <Trash2 data-icon="inline-start" />
                Удалить
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Измените карточку произведения или удалите его из каталога.
            </p>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
              type="button"
            >
              <Trash2 data-icon="inline-start" />
              Удалить произведение
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
