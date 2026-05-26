"use client";

import type { PublicUser } from "@fictrio/contracts";
import { create } from "zustand";

export type AuthUser = PublicUser;

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
  hydrate: () => void;
};

const storageKey = "fictrio.auth";

type StoredSession = {
  accessToken: string;
  user: AuthUser;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isHydrated: false,
  setSession: (accessToken, user) => {
    localStorage.setItem(storageKey, JSON.stringify({ accessToken, user }));
    set({ accessToken, user, isHydrated: true });
  },
  clearSession: () => {
    localStorage.removeItem(storageKey);
    set({ accessToken: null, user: null, isHydrated: true });
  },
  hydrate: () => {
    const rawSession = localStorage.getItem(storageKey);

    if (!rawSession) {
      set({ isHydrated: true });
      return;
    }

    try {
      const session = JSON.parse(rawSession) as StoredSession;
      set({
        accessToken: session.accessToken,
        user: session.user,
        isHydrated: true,
      });
    } catch {
      localStorage.removeItem(storageKey);
      set({ accessToken: null, user: null, isHydrated: true });
    }
  },
}));
