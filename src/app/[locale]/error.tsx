"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function LocaleError({
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
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">🪷</div>
        <h1 className="text-4xl font-bold text-deep mb-2">
          {t("somethingWentWrong")}
        </h1>
        <p className="text-lg text-deep/60 mb-6 max-w-md mx-auto">
          {t("errorDescription")}
        </p>
        <Button onClick={reset} variant="default">
          {t("tryAgain")}
        </Button>
      </div>
    </div>
  );
}
