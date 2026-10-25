import { useEffect, useState } from "react";
import { FEED_CATEGORY_CHIPS_LIMIT } from "@/lib/validation";
import type { CategoryRef } from "@/types/category";

// The taxonomy changes rarely and both feeds show the same chips: share one
// fetch per language across pages instead of refetching on every navigation.
const cache = new Map<string, CategoryRef[]>();
const EMPTY: CategoryRef[] = [];

/** Category chips for the feed filter bar, scoped to one language. */
export function useFeedCategories(language: string): CategoryRef[] {
  // The cache is the source of truth; this state only triggers the re-render
  // once an async fetch has filled it.
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (cache.has(language)) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: String(FEED_CATEGORY_CHIPS_LIMIT), language });
    fetch(`/api/categories?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.categories)) return;
        cache.set(language, data.categories);
        setVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [language]);

  return cache.get(language) ?? EMPTY;
}

/** Test seam: forget cached taxonomies between cases. */
export function clearFeedCategoriesCache() {
  cache.clear();
}
