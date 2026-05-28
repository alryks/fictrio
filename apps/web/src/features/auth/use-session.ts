"use client";

import type { PublicUser } from "@fictrio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { getMe } from "./auth-api";

export type AuthUser = PublicUser;

/**
 * Reads the current session user as server state via TanStack Query
 * (GET /auth/me) instead of mirroring it into a Zustand store. A 401 is
 * treated as "signed out" (user = null) rather than an error so the UI
 * does not flash an error state for anonymous visitors.
 */
export function useSession() {
  const query = useQuery({
    queryKey: qk.session,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return await getMe();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isPending,
  };
}

/** Imperatively updates the cached session user after login/logout. */
export function useSessionActions() {
  const queryClient = useQueryClient();

  return {
    setUser: (user: AuthUser | null) =>
      queryClient.setQueryData(qk.session, user),
  };
}
