"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import LotusIcon from "@/components/ui/lotus-icon";
import { Search, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function FeedEmptyState({ search, message, compact = false, error = false, onRetry, action }: {
  search?: string;
  message?: string;
  compact?: boolean;
  error?: boolean;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  const t = useTranslations("Categories");
  const common = useTranslations("Common");
  const Icon = error ? CircleAlert : search ? Search : LotusIcon;
  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", compact ? "py-6" : "py-10 px-4")}>
      {!compact && <Icon className="size-8 text-primary" aria-hidden="true" />}
      <p role={error ? "alert" : "status"} className="max-w-md text-muted-foreground leading-relaxed">
        {error ? common("feedLoadError") : search ? t("noResults", { query: search }) : message}
      </p>
      {error && onRetry ? <Button variant="outline" onClick={onRetry}>{common("retry")}</Button> : !error ? action : null}
    </div>
  );
}
