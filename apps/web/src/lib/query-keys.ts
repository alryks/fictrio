/**
 * Central registry of TanStack Query keys. Keeping every key in one place
 * keeps query and invalidation call sites in sync and documents the cache
 * namespaces:
 *
 *   ["works"]                      — catalog list (all filter variants)
 *   ["work", id]                   — single work card
 *   ["work", id, "reviews"]        — a work's reviews + ratings feed
 *   ["lists"]                      — public lists collection
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
  works: {
    all: ["works"] as const,
    list: (filters: unknown) => ["works", filters] as const,
    detail: (id: string) => ["work", id] as const,
    reviews: (id: string) => ["work", id, "reviews"] as const,
  },
  lists: {
    all: ["lists"] as const,
    public: ["lists", "public"] as const,
    mine: ["lists", "mine"] as const,
    detail: (id: string) => ["list", id] as const,
  },
  reviews: {
    all: ["review"] as const,
    comments: (reviewId: string) => ["review", reviewId, "comments"] as const,
  },
} as const;
