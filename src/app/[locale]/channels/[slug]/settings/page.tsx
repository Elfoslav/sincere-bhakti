import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { getChannelSettingsBySlug, resolveSlugRedirect } from "@/lib/services/channel";
import { getNoIndexMetadata } from "@/lib/seo";
import ChannelSettingsClient from "./settings-client";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ChannelSettingsPage" });

  return {
    ...getNoIndexMetadata(t("metaTitle")),
  };
}

export default async function ChannelSettingsPage({ params }: Props) {
  const { locale, slug } = await params;

  const session = await auth();
  if (!session?.user?.id) notFound();

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readChannelMembers, session.user.id, RATE_LIMITS.readChannelMembers.limit, RATE_LIMITS.readChannelMembers.windowMs)) notFound();

  const settings = await getChannelSettingsBySlug(slug, session.user.id);
  if (!settings) {
    const targetSlug = await resolveSlugRedirect(slug);
    if (targetSlug) {
      redirect(`/${locale}/channels/${targetSlug}/settings`);
    }
    notFound();
  }

  return <ChannelSettingsClient initialSettings={settings} />;
}
