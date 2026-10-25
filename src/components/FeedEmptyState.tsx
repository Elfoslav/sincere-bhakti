"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";

/**
 * Empty body for a feed list. While a search is active it explains that
 * nothing matched (instead of the generic "nothing here yet" copy, which would
 * be misleading) and points back to browsing.
 */
export default function FeedEmptyState({
  search,
  message,
  compact = false,
}: {
  search?: string;
  message: string;
  compact?: boolean;
}) {
  const t = useTranslations("Categories");
  return (
    <Card variant="ghost" className={compact && !search ? "text-center py-8" : "text-center py-12 px-6"}>
      {(!compact || search) && (
        <div className="mb-3 text-4xl" aria-hidden>
          {search ? "🪷" : "📿"}
        </div>
      )}
      <p role="status" className="text-muted-foreground">
        {search ? t("noResults", { query: search }) : message}
      </p>
    </Card>
  );
}
