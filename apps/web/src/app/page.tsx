"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { qk } from "@/lib/query-keys";
import { FeedView } from "@/features/feed/feed-view";
import { getFollowingFeed } from "@/features/feed/feed-api";
import { useSession } from "@/features/auth/use-session";

export default function Home() {
  const { user, isLoading } = useSession();
  const viewerScope = user ? `${user.id}:${user.roles.join(",")}` : "guest";

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader active="feed" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <section className="min-w-0 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Лента</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Оценки, отзывы и списки людей, на которых вы подписаны.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-40 w-full" />
              ))}
            </div>
          ) : user ? (
            <FeedView
              queryKey={(filter) => qk.feed.following(filter, viewerScope)}
              fetchPage={(filter, offset) => getFollowingFeed(filter, offset)}
              emptyTitle="В ленте пока пусто"
              emptyText="Подпишитесь на пользователей, чтобы видеть их активность."
            />
          ) : (
            <div className="space-y-4">
              <StateCard
                title="Лента доступна после входа"
                text="Войдите в аккаунт и подпишитесь на пользователей, чтобы следить за их оценками, отзывами и списками."
              />
              <Button asChild variant="outline" className="h-10">
                <Link href="/users">
                  <Users data-icon="inline-start" />
                  Найти пользователей
                </Link>
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
