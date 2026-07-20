"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ChannelSettingsError({
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
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-3xl font-bold text-deep">{t("somethingWentWrong")}</h1>
      <p className="mb-6 max-w-md text-deep/60">{t("errorDescription")}</p>
      <Button onClick={reset} variant="default">
        {t("tryAgain")}
      </Button>
    </div>
  );
}
