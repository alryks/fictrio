"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/use-session";
import { UserProfilePanel } from "@/features/users/user-profile-panel";

export default function ProfilePage() {
  const { user, isLoading } = useSession();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? <Skeleton className="h-56 w-full" /> : null}

        {!isLoading && !user ? (
          <>
            <StateCard
              as="h1"
              title="Профиль доступен после входа"
              text="Войдите или создайте аккаунт, чтобы редактировать свой профиль."
            />
            <div className="mt-4 flex justify-center">
              <Button asChild>
                <Link href="/auth">Перейти к входу</Link>
              </Button>
            </div>
          </>
        ) : null}

        {user ? <UserProfilePanel profile={user} viewer={user} /> : null}
      </main>
    </div>
  );
}
