"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/use-session";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/query-keys";
import { FeedView } from "@/features/feed/feed-view";
import { getUserFeed } from "@/features/feed/feed-api";
import { ProfileProgressSection } from "@/features/progress/profile-progress-section";
import { UserProfilePanel } from "@/features/users/user-profile-panel";
import { getUserProfile } from "@/features/users/users-api";

type ProfileTab = "feed" | "progress";

const tabs: Array<{ value: ProfileTab; label: string }> = [
  { value: "feed", label: "Лента" },
  { value: "progress", label: "Прогресс" },
];

export default function PublicUserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const { user } = useSession();
  const [tab, setTab] = useState<ProfileTab>("feed");

  const profileQuery = useQuery({
    queryKey: qk.users.profile(username),
    queryFn: () => getUserProfile(username),
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader active="people" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {profileQuery.isLoading ? <Skeleton className="h-56 w-full" /> : null}

        {profileQuery.isError ? (
          <StateCard
            as="h1"
            title="Профиль недоступен"
            text={profileQuery.error.message}
          />
        ) : null}

        {profileQuery.data ? (
          <div className="flex flex-col gap-6">
            <UserProfilePanel profile={profileQuery.data} viewer={user} />

            <div>
              <div className="grid max-w-md grid-cols-2 overflow-hidden rounded-md border bg-card text-sm font-medium">
                {tabs.map((item, index) => (
                  <button
                    key={item.value}
                    aria-current={tab === item.value ? "page" : undefined}
                    className={cn(
                      "h-11 transition",
                      index > 0 ? "border-l" : "",
                      tab === item.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => setTab(item.value)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {tab === "feed" ? (
                  <FeedView
                    queryKey={(filter) => qk.feed.user(username, filter)}
                    fetchPage={(filter, offset) =>
                      getUserFeed(username, filter, offset)
                    }
                    emptyTitle="Пока нет активности"
                    emptyText="Здесь появятся оценки, отзывы и списки пользователя."
                  />
                ) : (
                  <ProfileProgressSection username={username} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
