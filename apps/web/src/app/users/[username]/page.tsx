"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { qk } from "@/lib/query-keys";
import { useSession } from "@/features/auth/use-session";
import { UserProfilePanel } from "@/features/users/user-profile-panel";
import { getUserProfile } from "@/features/users/users-api";

export default function PublicUserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const { user } = useSession();
  const profileQuery = useQuery({
    queryKey: qk.users.profile(username),
    queryFn: () => getUserProfile(username),
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />

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
          <UserProfilePanel profile={profileQuery.data} viewer={user} />
        ) : null}
      </main>
    </div>
  );
}
