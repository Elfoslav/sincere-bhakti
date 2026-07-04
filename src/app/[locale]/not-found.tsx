"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const t = useTranslations("ErrorPages");

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🪷</div>
      <h1 className="text-4xl font-bold text-deep mb-2">404</h1>
      <p className="text-lg text-deep/60 mb-6">{t("notFound")}</p>
      <p className="text-deep/50 mb-8 max-w-md">
        {t("notFoundDescription")}
      </p>
      <Button href="/" variant="default">
        {t("goHome")}
      </Button>
    </div>
  );
}
