import { useEffect, useState } from "react";
import { FEED_CATEGORY_CHIPS_LIMIT, type FeedCategorySource } from "@/lib/validation";
import type { CategoryRef } from "@/types/category";

// The taxonomy changes rarely: share one fetch per language and feed across
// page navigations instead of refetching each time.
const cache = new Map<string, CategoryRef[]>();
const EMPTY: CategoryRef[] = [];

/** Category chips for a feed's filter bar: the language's most-used categories in that feed. */
export function useFeedCategories(language: string, usedBy: FeedCategorySource): CategoryRef[] {
  const key = `${language}:${usedBy}`;
  // The cache is the source of truth; this state only triggers the re-render
  // once an async fetch has filled it.
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (cache.has(key)) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: String(FEED_CATEGORY_CHIPS_LIMIT), language, usedBy });
    fetch(`/api/categories?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.categories)) return;
        cache.set(key, data.categories);
        setVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [key, language, usedBy]);

  return cache.get(key) ?? EMPTY;
}

/** Test seam: forget cached taxonomies between cases. */
export function clearFeedCategoriesCache() {
  cache.clear();
}
