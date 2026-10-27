"use client";

import type { CategoryRef } from "@/types/category";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SearchInput from "@/components/SearchInput";
import { useFeedCategories } from "@/lib/hooks/useFeedCategories";
import { withSearchQuery } from "@/lib/search-url";
import { cn } from "@/lib/utils";

const chipClassName =
  "inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/30";
const chipIdle = "bg-deep/5 text-muted-foreground hover:bg-gold-light/25 hover:text-deep";
const chipActive = "bg-gold-light/40 text-deep ring-1 ring-gold/40";

/**
 * Search + category browsing shared by the timeline and the blog so both
 * feeds filter the same way. Search is a controlled input (the page debounces
 * it into the feed query); categories are links to the existing
 * `${basePath}/category/[slug]` routes so a filtered view stays shareable.
 */
export default function FeedFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  basePath,
  activeCategory,
  loading = false,
  variant = "default",
  aside,
  categories: suppliedCategories,
  onCategorySelect,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  basePath: "/posts" | "/blog";
  activeCategory?: string;
  loading?: boolean;
  variant?: "default" | "editorial";
  aside?: ReactNode;
  categories?: CategoryRef[];
  onCategorySelect?: (name?: string) => void;
}) {
  const t = useTranslations("Categories");
  const locale = useLocale();
  const fetchedCategories = useFeedCategories(locale, basePath === "/blog" ? "blog" : "posts");
  const categories = suppliedCategories ?? fetchedCategories;

  const editorial = variant !== "default";

  return (
    <div role="search" className={editorial ? "article-filter-bar" : "mb-6 space-y-3"}>
      <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} loading={loading} className={editorial ? "article-search" : undefined} />
      <div className={editorial ? "article-filter-bottom" : undefined}>
      {categories.length > 0 && (
        <nav aria-label={t("browse")} className={editorial ? "article-categories" : undefined}>
          <ul className={editorial ? "article-category-list" : "flex flex-wrap gap-2"}>
            <li>
              <Link
                href={withSearchQuery(basePath, search)}
                onClick={onCategorySelect ? (event) => { event.preventDefault(); onCategorySelect(); } : undefined}
                aria-current={activeCategory ? undefined : "page"}
                className={editorial ? "article-category-link" : cn(chipClassName, activeCategory ? chipIdle : chipActive)}
              >
                {t("all")}
              </Link>
            </li>
            {categories.map((category) => {
              const active = category.name === activeCategory;
              return (
                <li key={category.id}>
                  <Link
                    href={withSearchQuery(`${basePath}/category/${category.slug}`, search)}
                    onClick={onCategorySelect ? (event) => { event.preventDefault(); onCategorySelect(category.name); } : undefined}
                    aria-current={active ? "page" : undefined}
                    className={editorial ? "article-category-link" : cn(chipClassName, active ? chipActive : chipIdle)}
                  >
                    {category.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      {aside}
      </div>
    </div>
  );
}
