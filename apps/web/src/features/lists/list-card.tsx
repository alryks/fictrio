"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { AverageRatingSummary } from "@/features/ratings/average-rating-summary";
import { RatingControl } from "@/features/ratings/rating-control";
import { WorkRail, getWorksCountLabel } from "@/features/works/work-rail";
import { deleteListRating, rateList } from "./lists-api";
import type { FictrioList } from "./lists-api";

export function ListCard({ list }: { list: FictrioList }) {
  const queryClient = useQueryClient();
  const { accessToken, user, isHydrated, hydrate } = useAuthStore();
  const works = list.items.map((item) => item.work);
  const [ratingDraft, setRatingDraft] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ratingValue = ratingDraft ?? list.userRating ?? 0;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const ratingMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для оценки списка нужно войти в аккаунт");
      }

      return rateList(list.id, (Math.floor(ratingValue) + 1) % 4, accessToken);
    },
    onSuccess: async (response) => {
      setRatingDraft(response.value);
      setMessage("Оценка списка сохранена");
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось оценить список",
      );
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Для удаления оценки нужно войти в аккаунт");
      }

      return deleteListRating(list.id, accessToken);
    },
    onSuccess: async () => {
      setRatingDraft(0);
      setMessage("Оценка списка удалена");
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : "Не удалось удалить оценку",
      );
    },
  });

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
          {message ? (
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          ) : null}
        </div>

        <RatingControl
          value={ratingValue}
          disabled={!isHydrated || !user || ratingMutation.isPending}
          deleteDisabled={!user || deleteRatingMutation.isPending}
          onChange={() => {
            setMessage(null);
            ratingMutation.mutate();
          }}
          onDelete={() => {
            setMessage(null);
            deleteRatingMutation.mutate();
          }}
        />
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
