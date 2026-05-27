"use client";

import type { PublicUser } from "@fictrio/contracts";
import { create } from "zustand";

export type AuthUser = PublicUser;

type AuthState = {
  user: AuthUser | null;
  isHydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  markHydrated: () => void;
};

/**
 * Auth store keeps only the public user profile. The JWT lives in an
 * HttpOnly cookie managed by the server, so the client has no direct
 * knowledge of the token. Hydration is driven by the providers calling
 * /auth/me on mount; until that resolves, isHydrated stays false so the
 * UI can render a loading shell without flashing the signed-out state.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  setUser: (user) => set({ user, isHydrated: true }),
  markHydrated: () => set({ isHydrated: true }),
}));
