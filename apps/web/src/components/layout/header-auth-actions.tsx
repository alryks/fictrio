"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserBadge } from "@/components/user-badge";
import { logout } from "@/features/auth/auth-api";
import { useSession, useSessionActions } from "@/features/auth/use-session";

export function HeaderAuthActions() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useSession();
  const { setUser } = useSessionActions();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // The local session still needs to disappear if the user explicitly
      // pressed logout and the cookie cleanup request failed.
    }

    setUser(null);

    if (pathname.startsWith("/profile")) {
      router.push("/auth");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2" aria-label="Загрузка сессии">
        <Skeleton className="size-10" />
        <Skeleton className="h-10 w-16" />
      </div>
    );
  }

  if (!user) {
    return (
      <Button asChild className="h-10">
        <Link href="/auth">
          <LogIn data-icon="inline-start" />
          Войти
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" className="size-10 p-0" title="Профиль">
        <Link href="/profile" aria-label="Открыть профиль">
          <UserBadge name={user.username} />
        </Link>
      </Button>
      <Button
        variant="outline"
        className="h-10"
        onClick={handleLogout}
        type="button"
      >
        <LogOut data-icon="inline-start" />
        Выйти
      </Button>
    </div>
  );
}
