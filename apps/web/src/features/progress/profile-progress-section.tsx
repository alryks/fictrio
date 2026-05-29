"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { qk } from "@/lib/query-keys";
import { WorkCard } from "@/features/works/work-card";
import { getUserProgressSummary, type ProgressListItem } from "./progress-api";

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[2/3] w-full" />
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
        <>
          <ProgressPreviewRail
            items={summaryQuery.data.started}
            title="В процессе"
            username={username}
            status="started"
            emptyText="Сейчас ничего не отслеживается."
          />
          <ProgressPreviewRail
            items={summaryQuery.data.completed}
            title="Просмотрено и прочитано"
            username={username}
            status="completed"
            emptyText="Завершенных произведений пока нет."
          />
        </>
      ) : null}
    </section>
  );
}

function ProgressPreviewRail({
  items,
  title,
  username,
  status,
  emptyText,
}: {
  items: ProgressListItem[];
  title: string;
  username: string;
  status: "started" | "completed";
  emptyText: string;
}) {
  return (
    <section className="min-w-0 rounded-md border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button asChild className="h-9" size="sm" variant="outline">
          <Link href={`/users/${username}/progress?status=${status}`}>
            Открыть
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>

      {items.length ? (
        <div className="min-w-0 overflow-hidden">
          <div className="-mx-4 mt-4 flex max-w-full gap-4 overflow-x-auto px-4 pb-2">
            {items.map((item) => (
              <div key={item.work.id} className="w-40 shrink-0 sm:w-44">
                <WorkCard
                  work={item.work}
                  href={`/catalog/${item.targetWorkId}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-md border bg-background p-4 text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </section>
  );
}
