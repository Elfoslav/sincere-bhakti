import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import DesignVariantsClient from "./design-variants-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "BlogPage" });

  return {
    title: t("designVariantsTitle"),
    description: t("designVariantsSubtitle"),
  };
}

export default async function BlogDesignVariantsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readBlogs, ip, RATE_LIMITS.readBlogs.limit, RATE_LIMITS.readBlogs.windowMs)) notFound();

  return <DesignVariantsClient />;
}
