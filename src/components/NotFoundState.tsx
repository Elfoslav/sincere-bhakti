"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function NotFoundState({ jokeIndex }: { jokeIndex: number }) {
  const t = useTranslations("ErrorPages");

  return (
    <div className="auth-layout flex-col text-center">
      <title>{`404 · ${t("somethingWentWrong")}`}</title>
      <div className="text-6xl mb-4">🤷</div>
      <h1 className="type-title mb-3">404</h1>
      <p className="text-lg text-muted-foreground mb-2">{t(`joke${jokeIndex}Headline`)}</p>
      <p className="text-muted-foreground mb-8 max-w-md">{t(`joke${jokeIndex}Punchline`)}</p>
      <Button href="/posts" variant="default">
        {t("backToPosts")}
      </Button>
    </div>
  );
}
