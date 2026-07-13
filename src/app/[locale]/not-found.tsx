"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export default function NotFoundPage() {
  const t = useTranslations("ErrorPages");
  const jokeIdx = getRandomInt(7);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">🤷</div>
      <h1 className="text-4xl font-bold text-deep mb-2">404</h1>
      <p className="text-lg text-deep/60 mb-2">{t(`joke${jokeIdx}Headline`)}</p>
      <p className="text-deep/50 mb-8 max-w-md">{t(`joke${jokeIdx}Punchline`)}</p>
      <Button href="/posts" variant="default">
        {t("backToPosts")}
      </Button>
    </div>
  );
}
