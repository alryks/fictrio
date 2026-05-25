"use client";

import Link from "next/link";
import { BookOpen, Film, Layers3, Tv } from "lucide-react";
import { RatingMark } from "@/components/ui/rating-mark";
import { WorkKind, WorkListItem } from "@/features/works/works-api";

const kindLabels: Record<WorkKind, string> = {
  movie: "Фильм",
  show: "Сериал",
  season: "Сезон",
  episode: "Эпизод",
  book: "Книга",
};

const kindIcons = {
  movie: Film,
  show: Tv,
  season: Layers3,
  episode: Tv,
  book: BookOpen,
};

export function WorkCard({ work }: { work: WorkListItem }) {
  const Icon = kindIcons[work.kind];
  const releaseYear = work.releaseYear
    ? String(work.releaseYear)
    : "Год неизвестен";

  return (
    <Link
      className="group block w-full min-w-[160px] overflow-hidden rounded-md border bg-card shadow-sm outline-none transition hover:border-primary hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50"
      href={`/catalog/${work.id}`}
    >
      <article
        className="relative aspect-[2/3] bg-linear-to-br from-[#3838a8] via-[#6666cc] to-[#9f9fdf] bg-cover bg-center"
        style={
          work.imageUrl
            ? { backgroundImage: `url(${work.imageUrl})` }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(24,24,36,0.42),transparent_48%)]" />

        <div className="absolute left-3 top-3 grid size-9 place-items-center rounded-md bg-background/92 text-primary shadow-sm backdrop-blur">
          <Icon className="size-5" />
          <span className="sr-only">{kindLabels[work.kind]}</span>
        </div>

        <div className="absolute right-3 top-3 grid size-9 place-items-center rounded-md bg-background/92 text-primary shadow-sm backdrop-blur">
          <RatingMark value={work.rating.average ?? 0} size="sm" />
        </div>

        <div className="absolute inset-0 flex translate-y-full flex-col justify-end bg-[linear-gradient(to_top,rgba(17,17,28,0.98)_0%,rgba(17,17,28,0.9)_45%,rgba(17,17,28,0.55)_72%,rgba(17,17,28,0.08)_100%)] p-4 text-white opacity-0 transition duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-white/80">
            <span>{kindLabels[work.kind]}</span>
            <span>{releaseYear}</span>
          </div>
          <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-6">
            {work.title}
          </h2>
          <p className="mt-3 line-clamp-5 text-sm leading-6 text-white/82">
            {work.description ?? "Описание пока не добавлено."}
          </p>
        </div>
      </article>
    </Link>
  );
}
