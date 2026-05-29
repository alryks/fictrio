"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { StateCard } from "@/components/state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { qk } from "@/lib/query-keys";
import { WorkCard } from "@/features/works/work-card";
import {
  getUserProgressSummary,
  type ProgressListItem,
  type ProgressStatus,
} from "./progress-api";

type ProfileProgressSectionProps = {
  username: string;
};

export function ProfileProgressSection({
  username,
}: ProfileProgressSectionProps) {
  const summaryQuery = useQuery({
    queryKey: qk.progress.summary(username),
    queryFn: () => getUserProgressSummary(username),
  });

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">Прогресс</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Фильмы, сериалы и книги, которые пользователь сейчас проходит или уже
          завершил.
        </p>
      </div>

      {summaryQuery.isLoading ? (
        <div className="flex flex-col gap-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      ) : null}

      {summaryQuery.isError ? (
        <StateCard
          title="Не удалось загрузить прогресс"
          text={summaryQuery.error.message}
        />
      ) : null}

      {summaryQuery.data ? (
        <div className="flex flex-col gap-5">
          <ProgressPreviewCard
            items={summaryQuery.data.started}
            title="В процессе"
            username={username}
            status="started"
            emptyText="Сейчас ничего не отслеживается."
          />
          <ProgressPreviewCard
            items={summaryQuery.data.completed}
            title="Просмотрено и прочитано"
            username={username}
            status="completed"
            emptyText="Завершенных произведений пока нет."
          />
        </div>
      ) : null}
    </section>
  );
}

function ProgressPreviewCard({
  items,
  title,
  username,
  status,
  emptyText,
}: {
  items: ProgressListItem[];
  title: string;
  username: string;
  status: ProgressStatus;
  emptyText: string;
}) {
  const preview = items.slice(0, 6);
  const href = `/users/${username}/progress?status=${status}`;

  return (
    <article className="min-w-0 overflow-hidden rounded-md border bg-card p-5 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="text-xl font-semibold text-primary">{title}</h3>
      </div>

      <div className="mt-4 min-w-0">
        {preview.length ? (
          <div className="min-w-0 overflow-hidden">
            <div className="-mx-5 flex max-w-full gap-4 overflow-x-auto px-5 pb-3">
              {preview.map((item) => (
                <div key={item.work.id} className="w-40 shrink-0 sm:w-44">
                  <WorkCard
                    work={item.work}
                    href={`/catalog/${item.targetWorkId}`}
                  />
                </div>
              ))}
              <Link
                className="group flex w-40 shrink-0 flex-col overflow-hidden rounded-md border bg-card shadow-sm outline-none transition hover:border-primary hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-44"
                href={href}
              >
                <div className="grid aspect-[2/3] place-items-center bg-background p-4 text-center">
                  <div>
                    <div className="mx-auto grid size-10 place-items-center rounded-md bg-accent text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <ArrowRight className="size-5" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-primary">
                      Открыть прогресс
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Перейти к списку
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        ) : (
          <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
            {emptyText}
          </p>
        )}
      </div>
    </article>
  );
}
