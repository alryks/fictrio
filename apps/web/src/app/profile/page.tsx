"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/use-session";

/**
 * The signed-in user's profile lives at the same public route as everyone
 * else's (`/users/:username`), where the owner additionally gets editing and
 * sees no follow button. This route just forwards there once the session is
 * known.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (user) {
      router.replace(`/users/${user.username}`);
    }
  }, [router, user]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {isLoading || user ? <Skeleton className="h-56 w-full" /> : null}

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
      </main>
    </div>
  );
}
