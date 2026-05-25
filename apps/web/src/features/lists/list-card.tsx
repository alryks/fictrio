import Link from "next/link";
import { ListChecks } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import type { FictrioList } from "./lists-api";

export function ListCard({ list }: { list: FictrioList }) {
  const previewItems = list.items.slice(0, 4);

  return (
    <article className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            className="text-lg font-semibold text-primary hover:underline"
            href={`/lists/${list.id}`}
          >
            {list.title}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            @{list.owner.username} · {list.items.length}{" "}
            {getItemsLabel(list.items.length)}
          </p>
        </div>
        <div className="shrink-0">
          <RatingMark value={list.rating.average ?? 0} size="lg" />
        </div>
      </div>

      {list.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6">
          {list.description}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {previewItems.map((item) => (
          <Link
            className="min-h-20 rounded-md border bg-background p-2 text-xs font-medium transition hover:border-primary hover:text-primary"
            href={`/catalog/${item.work.id}`}
            key={item.work.id}
          >
            <span className="line-clamp-3">{item.work.title}</span>
          </Link>
        ))}
        {previewItems.length === 0 ? (
          <div className="col-span-full flex min-h-20 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground">
            <ListChecks className="mr-2 size-4" />
            Список пока пуст
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function getItemsLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "элемент";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "элемента";
  }

  return "элементов";
}
