/**
 * Central registry of TanStack Query keys. Keeping every key in one place
 * keeps query and invalidation call sites in sync and documents the cache
 * namespaces:
 *
 *   ["works"]                      — catalog list (all filter variants)
 *   ["work", id]                   — single work card
 *   ["work", id, "reviews"]        — a work's reviews + ratings feed
 *   ["lists", "public", filters]   — public lists collection
 *   ["lists", "mine"]              — current user's lists
 *   ["list", id]                   — single list
 *   ["review"]                     — every review's comment threads
 *   ["review", id, "comments"]     — one review's comments
 *
 * Note the prefix relationships: invalidating ["works"] also matches
 * ["works", filters]; invalidating ["work", id] also matches
 * ["work", id, "reviews"].
 */
export const qk = {
  /** Current authenticated user (or null). Backed by GET /auth/me. */
  session: ["session"] as const,
  works: {
    all: ["works"] as const,
    list: (filters: unknown) => ["works", filters] as const,
    detail: (id: string) => ["work", id] as const,
    reviews: (id: string) => ["work", id, "reviews"] as const,
  },
  lists: {
    all: ["lists"] as const,
    public: (filters: unknown) => ["lists", "public", filters] as const,
    mine: ["lists", "mine"] as const,
    detail: (id: string) => ["list", id] as const,
  },
  progress: {
    all: ["progress"] as const,
    summary: (username: string) => ["progress", username, "summary"] as const,
    list: (filters: unknown) => ["progress", "list", filters] as const,
  },
  users: {
    all: ["users"] as const,
    profile: (username: string) => ["user", username] as const,
    search: (search: string) => ["users", "search", search] as const,
    followers: (username: string, search: string) =>
      ["users", username, "followers", search] as const,
    following: (username: string, search: string) =>
      ["users", username, "following", search] as const,
  },
  reviews: {
    all: ["review"] as const,
    comments: (reviewId: string) => ["review", reviewId, "comments"] as const,
  },
  feed: {
    all: ["feed"] as const,
    following: (filter: string) => ["feed", "following", filter] as const,
    user: (username: string, filter: string) =>
      ["feed", "user", username, filter] as const,
  },
} as const;
