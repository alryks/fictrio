"use client";

import { Suspense } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Check, Clock3 } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { qk } from "@/lib/query-keys";
import { useInfiniteScroll } from "@/lib/use-infinite-scroll";
import { WorkCard } from "@/features/works/work-card";
import {
  getUserProgress,
  type ProgressStatus,
} from "@/features/progress/progress-api";

const pageSize = 24;

const statusLabels: Record<ProgressStatus, string> = {
  started: "В процессе",
  completed: "Просмотрено и прочитано",
};

export default function UserProgressPage() {
  return (
    <Suspense
      fallback={
        <StateCard
          className="mt-5"
          title="Загрузка прогресса"
          text="Подготавливаем список произведений."
        />
      }
    >
      <UserProgressContent />
    </Suspense>
  );
}

function UserProgressContent() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = getStatus(searchParams);

  const progressQuery = useInfiniteQuery({
    queryKey: qk.progress.list({ username, status }),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getUserProgress(username, {
        status,
        limit: pageSize,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;

      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
  });
  const items = progressQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = progressQuery.data?.pages[0]?.total ?? 0;
  const loadMoreRef = useInfiniteScroll({
    hasNextPage: progressQuery.hasNextPage,
    isFetchingNextPage: progressQuery.isFetchingNextPage,
    fetchNextPage: progressQuery.fetchNextPage,
    rootMargin: "600px 0px",
  });

  function setStatus(nextStatus: ProgressStatus) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("status", nextStatus);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{statusLabels[status]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              @{username}: фильмы, сериалы и книги из прогресса.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Показано: {items.length} из {total}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className="h-10"
            onClick={() => setStatus("started")}
            type="button"
            variant={status === "started" ? "default" : "outline"}
          >
            <Clock3 data-icon="inline-start" />В процессе
          </Button>
          <Button
            className="h-10"
            onClick={() => setStatus("completed")}
            type="button"
            variant={status === "completed" ? "default" : "outline"}
          >
            <Check data-icon="inline-start" />
            Просмотрено
          </Button>
        </div>

        {progressQuery.isLoading ? <ProgressSkeletonGrid /> : null}

        {progressQuery.isError ? (
          <StateCard
            className="mt-5"
            title="Не удалось загрузить прогресс"
            text={progressQuery.error.message}
          />
        ) : null}

        {!progressQuery.isLoading &&
        !progressQuery.isError &&
        items.length === 0 ? (
          <StateCard
            className="mt-5"
            title="Список пуст"
            text="Для этого статуса пока нет произведений."
          />
        ) : null}

        {items.length > 0 ? (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => (
              <WorkCard
                key={item.work.id}
                work={item.work}
                href={`/catalog/${item.targetWorkId}`}
              />
            ))}
          </section>
        ) : null}

        <div ref={loadMoreRef} className="h-8" />

        {progressQuery.isFetchingNextPage ? <ProgressSkeletonGrid /> : null}

        {progressQuery.hasNextPage && !progressQuery.isFetchingNextPage ? (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => void progressQuery.fetchNextPage()}
              type="button"
            >
              Загрузить еще
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ProgressSkeletonGrid() {
  return (
    <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton key={index} className="aspect-[2/3] w-full" />
      ))}
    </section>
  );
}

function getStatus(searchParams: URLSearchParams): ProgressStatus {
  return searchParams.get("status") === "completed" ? "completed" : "started";
}
