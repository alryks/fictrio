import Link from "next/link";
import { RatingMark } from "@/components/ui/rating-mark";
import { WorkRail, getWorksCountLabel } from "@/features/works/work-rail";
import type { FictrioList } from "./lists-api";

export function ListCard({ list }: { list: FictrioList }) {
  const works = list.items.map((item) => item.work);

  return (
    <article className="rounded-md border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
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

        <Link
          className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
          href={`/lists/${list.id}`}
        >
          Открыть список
        </Link>
      </header>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            className="text-xl font-semibold text-primary hover:underline"
            href={`/lists/${list.id}`}
          >
            {list.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.items.length} {getWorksCountLabel(list.items.length)}
          </p>
        </div>
        <RatingMark
          className="shrink-0"
          value={list.rating.average ?? 0}
          size="lg"
        />
      </div>

      {list.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6">
          {list.description}
        </p>
      ) : null}

      <div className="mt-2">
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
