"use client";

import Link from "next/link";
import { AverageRatingSummary } from "@/features/ratings/average-rating-summary";
import { WorkRail, getWorksCountLabel } from "@/features/works/work-rail";
import type { FictrioList } from "./lists-api";

export function ListCard({ list }: { list: FictrioList }) {
  const works = list.items.map((item) => item.work);

  return (
    <article className="min-w-0 overflow-hidden rounded-md border bg-card p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
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

          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
            <Link
              className="text-xl font-semibold text-primary hover:underline"
              href={`/lists/${list.id}`}
            >
              {list.title}
            </Link>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">
              {list.items.length} {getWorksCountLabel(list.items.length)}
            </span>
          </div>
        </header>

        <AverageRatingSummary
          average={list.rating.average}
          count={list.rating.count}
        />

        <div className="min-w-0">
          {list.description ? (
            <p className="line-clamp-3 text-sm leading-6">{list.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Описание пока не добавлено.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <WorkRail works={works} emptyText="Список пока пуст." />
      </div>
    </article>
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
