"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Shared error-boundary body. Every route-segment `error.tsx` renders this —
 * a segment file stays a 3-line wrapper so the copy (translations, hero,
 * retry) can't drift between segments.
 */
export default function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPages");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="auth-layout">
      <div className="text-center">
        <div className="text-6xl mb-4">🪷</div>
        <h1 className="type-title mb-3">
          {t("somethingWentWrong")}
        </h1>
        <p className="text-lg text-muted-foreground mb-6 max-w-md mx-auto">
          {t("errorDescription")}
        </p>
        <Button onClick={reset} variant="default">
          {t("tryAgain")}
        </Button>
      </div>
    </div>
  );
}
