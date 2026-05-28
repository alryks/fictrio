"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UserLink } from "@/components/user-link";
import { formatDate, getWorksCountLabel } from "@/lib/format";
import { AverageRatingSummary } from "@/features/ratings/average-rating-summary";
import { WorkCard } from "@/features/works/work-card";
import type { FictrioList } from "./lists-api";

export function ListCard({ list }: { list: FictrioList }) {
  const works = list.items.slice(0, 6).map((item) => item.work);
  const hiddenWorksCount = Math.max(list.itemsTotal - works.length, 0);

  return (
    <article className="min-w-0 overflow-hidden rounded-md border bg-card p-5 shadow-sm">
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <header className="min-w-0">
            <UserLink user={list.owner} meta={formatDate(list.createdAt)} />

            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
              <Link
                className="text-xl font-semibold text-primary hover:underline"
                href={`/lists/${list.id}`}
              >
                {list.title}
              </Link>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                {list.itemsTotal} {getWorksCountLabel(list.itemsTotal)}
              </span>
            </div>
          </header>

          {list.description ? (
            <p className="mt-4 line-clamp-3 text-sm leading-6">
              {list.description}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Описание пока не добавлено.
            </p>
          )}
        </div>

        <AverageRatingSummary
          className="self-start"
          average={list.rating.average}
          count={list.rating.count}
        />
      </div>

      <div className="mt-4 min-w-0">
        {works.length ? (
          <div className="min-w-0 overflow-hidden">
            <div className="-mx-5 flex max-w-full gap-4 overflow-x-auto px-5 pb-3">
              {works.map((work) => (
                <div key={work.id} className="w-40 shrink-0 sm:w-44">
                  <WorkCard work={work} />
                </div>
              ))}
              <Link
                className="group flex w-40 shrink-0 flex-col overflow-hidden rounded-md border bg-card shadow-sm outline-none transition hover:border-primary hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-44"
                href={`/lists/${list.id}`}
              >
                <div className="grid aspect-[2/3] place-items-center bg-background p-4 text-center">
                  <div>
                    <div className="mx-auto grid size-10 place-items-center rounded-md bg-accent text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <ArrowRight className="size-5" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-primary">
                      Открыть список
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hiddenWorksCount > 0
                        ? `Еще ${hiddenWorksCount} ${getWorksCountLabel(hiddenWorksCount)}`
                        : "Перейти к подборке"}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        ) : (
          <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
            Список пока пуст.
          </p>
        )}
      </div>
    </article>
  );
}
