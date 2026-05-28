"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, ListChecks, Mail, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { UserBadge } from "@/components/user-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, getWorksCountLabel } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { useSession } from "@/features/auth/use-session";
import { getMyLists } from "@/features/lists/lists-api";
import { AverageRatingSummary } from "@/features/ratings/average-rating-summary";

const roleLabels: Record<string, string> = {
  user: "Пользователь",
  moderator: "Модератор",
  admin: "Администратор",
};

export default function ProfilePage() {
  const { user, isLoading } = useSession();
  const listsQuery = useQuery({
    queryKey: qk.lists.mine,
    queryFn: getMyLists,
    enabled: Boolean(user),
  });

  const lists = listsQuery.data?.items ?? [];
  const totalLists = listsQuery.data?.total ?? lists.length;
  const totalWorks = lists.reduce((count, list) => count + list.itemsTotal, 0);
  const ratedLists = lists.filter((list) => list.userRating !== null).length;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader active="profile" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? <ProfileSkeleton /> : null}

        {!isLoading && !user ? (
          <StateCard
            as="h1"
            title="Профиль доступен после входа"
            text="Войдите или создайте аккаунт, чтобы видеть свои списки и активность."
          />
        ) : null}

        {!isLoading && !user ? (
          <div className="mt-4 flex justify-center">
            <Button asChild>
              <Link href="/auth">Перейти к входу</Link>
            </Button>
          </div>
        ) : null}

        {user ? (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="min-w-0">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <UserBadge
                      name={user.username}
                      size="md"
                      tone="primary"
                      className="size-16 text-lg"
                    />
                    <div className="min-w-0">
                      <CardTitle className="truncate text-xl">
                        {user.displayName}
                      </CardTitle>
                      <CardDescription className="truncate">
                        @{user.username}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {user.bio ?? "Описание профиля пока не добавлено."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((role) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                        key={role}
                      >
                        <ShieldCheck />
                        {roleLabels[role] ?? role}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </aside>

            <section className="min-w-0">
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  icon={ListChecks}
                  label="Списки"
                  value={String(totalLists)}
                />
                <MetricCard
                  icon={BookMarked}
                  label="В списках"
                  value={`${totalWorks} ${getWorksCountLabel(totalWorks)}`}
                />
                <MetricCard
                  icon={ShieldCheck}
                  label="Оценено списков"
                  value={String(ratedLists)}
                />
              </div>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold">Профиль</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ваши данные, роли и пользовательские списки.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/lists">Все публичные списки</Link>
                </Button>
              </div>

              {listsQuery.isLoading ? (
                <div className="mt-5 grid gap-4">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : null}

              {listsQuery.isError ? (
                <StateCard
                  className="mt-5"
                  title="Не удалось загрузить списки"
                  text={listsQuery.error.message}
                />
              ) : null}

              {!listsQuery.isLoading && lists.length === 0 ? (
                <StateCard
                  className="mt-5"
                  title="Списков пока нет"
                  text="Создайте список с произведениями из каталога, чтобы он появился здесь."
                />
              ) : null}

              {lists.length ? (
                <div className="mt-5 grid gap-4">
                  {lists.slice(0, 5).map((list) => (
                    <article
                      className="rounded-md border bg-card p-5 shadow-sm"
                      key={list.id}
                    >
                      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0">
                          <Link
                            className="text-lg font-semibold text-primary hover:underline"
                            href={`/lists/${list.id}`}
                          >
                            {list.title}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(list.createdAt)} · {list.itemsTotal}{" "}
                            {getWorksCountLabel(list.itemsTotal)}
                          </p>
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {list.description ?? "Описание пока не добавлено."}
                          </p>
                        </div>
                        <AverageRatingSummary
                          average={list.rating.average}
                          count={list.rating.count}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ListChecks;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-primary">
          <Icon />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Skeleton className="size-16" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  );
}
