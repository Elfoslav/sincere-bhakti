"use client";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { localeNames, type Locale } from "@/i18n/routing";
export default function ContentLanguageNotice() {
  const locale = useLocale() as Locale;
  const t = useTranslations("Common");
  return <p className="mb-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Languages className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{t("publishingLanguage", { language: localeNames[locale] })}</p>;
}
