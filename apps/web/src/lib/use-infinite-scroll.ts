"use client";

import { useEffect, useRef } from "react";

type UseInfiniteScrollOptions = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  /** Distance from the sentinel at which to prefetch the next page. */
  rootMargin?: string;
  /**
   * Scroll container to observe within. Defaults to the viewport; pass the
   * scrollable element when the list lives inside its own overflow container
   * (e.g. a dialog), otherwise the sentinel would always count as visible.
   */
  root?: Element | null;
};

/**
 * Observes a sentinel element and fetches the next page when it scrolls
 * into view. Returns a ref to attach to the sentinel. Replaces the
 * hand-rolled IntersectionObserver effects that were duplicated across
 * the catalog, list detail and reviews views.
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  rootMargin = "320px 0px",
  root = null,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = sentinelRef.current;

    if (!target || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, rootMargin },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, root, rootMargin]);

  return sentinelRef;
}
