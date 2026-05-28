"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { bootstrapCsrfToken } from "@/lib/api";

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
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}

/**
 * Side effects that run once on app mount: ensure the CSRF cookie exists so
 * the first mutation succeeds, and drop the legacy localStorage entry from
 * the pre-cookie auth implementation. The session user itself is fetched
 * lazily by useSession() where it is needed.
 */
function SessionBootstrap() {
  useEffect(() => {
    void bootstrapCsrfToken().catch(() => {
      // Best-effort; mutations will surface a clear error if the CSRF
      // cookie is still missing.
    });

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("fictrio.auth");
    }
  }, []);

  return null;
}
