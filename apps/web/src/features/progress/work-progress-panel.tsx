"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Clock3, Play, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { qk } from "@/lib/query-keys";
import { requireUser } from "@/lib/require-user";
import { useSession } from "@/features/auth/use-session";
import type { WorkDetails } from "@/features/works/works-api";
import {
  deleteWorkProgress,
  upsertWorkProgress,
  type ProgressStatus,
} from "./progress-api";

type WorkProgressPanelProps = {
  work: WorkDetails;
};

const statusLabels: Record<ProgressStatus, string> = {
  started: "В процессе",
  completed: "Завершено",
};

export function WorkProgressPanel({ work }: WorkProgressPanelProps) {
  const queryClient = useQueryClient();
  const { user, isLoading } = useSession();
  const isGroup = work.kind === "show" || work.kind === "season";
  const unitLabel = work.kind === "book" ? "страниц" : "минут";
  const defaultMax = useMemo(() => getDefaultMax(work), [work]);
  const progress = work.userProgress ?? null;

  const upsertMutation = useMutation({
    mutationFn: (input: {
      status: ProgressStatus;
      valueNow?: number;
      valueMax?: number;
    }) => {
      requireUser(user, "изменения прогресса");
      return upsertWorkProgress(work.id, input);
    },
    onSuccess: async () => {
      toast.success("Прогресс обновлен");
      await invalidateProgressQueries(queryClient, work.id);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Не удалось обновить прогресс",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      requireUser(user, "удаления прогресса");
      return deleteWorkProgress(work.id);
    },
    onSuccess: async () => {
      toast.success("Прогресс удален");
      await invalidateProgressQueries(queryClient, work.id);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить прогресс",
      );
    },
  });

  function setCustomProgress(valueNow: number, valueMax: number) {
    upsertMutation.mutate({
      status: "started",
      valueNow,
      valueMax,
    });
  }

  function setStarted() {
    upsertMutation.mutate({ status: "started" });
  }

  function setCompleted() {
    upsertMutation.mutate({ status: "completed" });
  }

  const isPending = upsertMutation.isPending || deleteMutation.isPending;

  return (
    <section className="mt-6 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 shrink-0 text-primary" />
            <h2 className="text-lg font-semibold">Прогресс</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {getProgressText(work, progress)}
          </p>
        </div>
        <div className="rounded-md border bg-card px-3 py-2 text-sm font-medium">
          {progress?.status ? statusLabels[progress.status] : "Нет прогресса"}
        </div>
      </div>

      {!user && !isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Войдите в аккаунт, чтобы отмечать просмотр или чтение.
        </p>
      ) : null}

      {isGroup ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            className="h-10"
            disabled={!user || isPending}
            onClick={setStarted}
            type="button"
            variant="outline"
          >
            <Play data-icon="inline-start" />
            Начато
          </Button>
          <Button
            className="h-10"
            disabled={!user || isPending}
            onClick={setCompleted}
            type="button"
          >
            <Check data-icon="inline-start" />
            Просмотрено
          </Button>
          <Button
            className="h-10"
            disabled={!user || isPending || !progress?.status}
            onClick={() => deleteMutation.mutate()}
            type="button"
            variant="destructive"
          >
            <Trash2 data-icon="inline-start" />
            Удалить
          </Button>
        </div>
      ) : (
        <ContentProgressForm
          key={`${progress?.updatedAt ?? "empty"}-${defaultMax}`}
          defaultValueNow={progress?.valueNow ?? 0}
          defaultValueMax={progress?.valueMax ?? defaultMax}
          disabled={!user || isPending}
          hasProgress={Boolean(progress?.status)}
          unitLabel={unitLabel}
          onCompleted={setCompleted}
          onCustomProgress={setCustomProgress}
          onDelete={() => deleteMutation.mutate()}
          onStarted={setStarted}
        />
      )}
    </section>
  );
}

function ContentProgressForm({
  defaultValueNow,
  defaultValueMax,
  disabled,
  hasProgress,
  unitLabel,
  onCompleted,
  onCustomProgress,
  onDelete,
  onStarted,
}: {
  defaultValueNow: number;
  defaultValueMax: number;
  disabled: boolean;
  hasProgress: boolean;
  unitLabel: string;
  onCompleted: () => void;
  onCustomProgress: (valueNow: number, valueMax: number) => void;
  onDelete: () => void;
  onStarted: () => void;
}) {
  const [valueNow, setValueNow] = useState(String(defaultValueNow));
  const [valueMax, setValueMax] = useState(String(defaultValueMax));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCustomProgress(Number(valueNow), Number(valueMax));
  }

  return (
    <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={`Сейчас, ${unitLabel}`}>
          {(field) => (
            <Input
              {...field}
              disabled={disabled}
              min={0}
              onChange={(event) => setValueNow(event.target.value)}
              required
              step={1}
              type="number"
              value={valueNow}
            />
          )}
        </FormField>
        <FormField label={`Всего, ${unitLabel}`}>
          {(field) => (
            <Input
              {...field}
              disabled={disabled}
              min={1}
              onChange={(event) => setValueMax(event.target.value)}
              required
              step={1}
              type="number"
              value={valueMax}
            />
          )}
        </FormField>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-10"
          disabled={disabled}
          onClick={onStarted}
          type="button"
          variant="outline"
        >
          <Play data-icon="inline-start" />
          Начать
        </Button>
        <Button className="h-10" disabled={disabled} type="submit">
          <Clock3 data-icon="inline-start" />
          Сохранить
        </Button>
        <Button
          className="h-10"
          disabled={disabled}
          onClick={onCompleted}
          type="button"
        >
          <Check data-icon="inline-start" />
          Завершено
        </Button>
        <Button
          className="h-10"
          disabled={disabled || !hasProgress}
          onClick={onDelete}
          type="button"
          variant="destructive"
        >
          <Trash2 data-icon="inline-start" />
          Удалить
        </Button>
      </div>
    </form>
  );
}

async function invalidateProgressQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  workId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.works.detail(workId) }),
    queryClient.invalidateQueries({ queryKey: qk.progress.all }),
  ]);
}

function getProgressText(
  work: WorkDetails,
  progress: WorkDetails["userProgress"] | null,
) {
  if (!progress?.status) {
    return "Отметьте, что начали, или сразу перенесите произведение в завершенные.";
  }

  if (work.kind === "show" || work.kind === "season") {
    return `${progress.completedItems ?? 0} из ${
      progress.totalItems ?? 0
    } эпизодов завершено.`;
  }

  const unit = work.kind === "book" ? "стр." : "мин.";
  return `${progress.valueNow ?? 0} из ${progress.valueMax ?? 1} ${unit}`;
}

function getDefaultMax(work: WorkDetails) {
  if (work.kind !== "movie" && work.kind !== "episode") {
    return 1;
  }

  const value = work.meta.runtimeMinutes;
  if (typeof value === "number" && value > 0) {
    return value;
  }

  return 1;
}
