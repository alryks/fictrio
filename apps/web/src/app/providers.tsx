"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { ApiError, bootstrapCsrfToken } from "@/lib/api";
import { getMe } from "@/features/auth/auth-api";
import { useAuthStore } from "@/features/auth/auth-store";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap />
      {children}
    </QueryClientProvider>
  );
}

/**
 * Ensures both the CSRF cookie and the current user are loaded once on
 * app mount. The auth store keeps `isHydrated` false until the request
 * resolves so dependent UI can render a loading state instead of flashing
 * a signed-out view.
 */
function SessionBootstrap() {
  const setUser = useAuthStore((state) => state.setUser);
  const markHydrated = useAuthStore((state) => state.markHydrated);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await bootstrapCsrfToken();
      } catch {
        // Best-effort bootstrap; mutations will fail loudly later if the
        // CSRF cookie is still missing.
      }

      try {
        const user = await getMe();
        if (!cancelled) {
          setUser(user);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 401) {
            setUser(null);
          } else {
            markHydrated();
          }
        }
      }

      // Clean up the legacy localStorage entry from the pre-cookie auth
      // implementation so it does not linger on returning users.
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("fictrio.auth");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [markHydrated, setUser]);

  return null;
}
