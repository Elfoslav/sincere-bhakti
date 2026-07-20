import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveSlugRedirect, getCachedChannelBySlug } from "@/lib/services/channel";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import {
  POST_OG_IMAGE,
  createBreadcrumbJsonLd,
  createChannelJsonLd,
  createJsonLdScript,
  getCanonicalAlternates,
  getChannelOpenGraphImageUrl,
  getLocalizedUrl,
  getOpenGraphLocale,
} from "@/lib/seo";
import ChannelPageClient from "./channel-page-client";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "ChannelPage" });

  const channel = await getCachedChannelBySlug(slug);

  if (!channel) {
    return { title: t("notFound") };
  }

  const description = t("metaDescription", { name: channel.name });
  const imageUrl = getChannelOpenGraphImageUrl(locale, channel.slug);

  return {
    title: channel.name,
    description,
    alternates: getCanonicalAlternates(locale, `/channels/${channel.slug}`),
    openGraph: {
      title: channel.name,
      description,
      type: "website",
      locale: getOpenGraphLocale(locale),
      url: getCanonicalAlternates(locale, `/channels/${channel.slug}`)?.canonical as string,
      siteName: "Sincere Bhakti",
      images: [{ ...POST_OG_IMAGE, url: imageUrl, alt: channel.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: channel.name,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ChannelPage({ params }: Props) {
  const { locale, slug } = await params;

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readChannel, ip, RATE_LIMITS.readChannel.limit, RATE_LIMITS.readChannel.windowMs)) notFound();

  const channel = await getCachedChannelBySlug(slug);

  if (!channel) {
    const targetSlug = await resolveSlugRedirect(slug);
    if (targetSlug) {
      redirect(`/${locale}/channels/${targetSlug}`);
    }
    notFound();
  }

  const [t, channelsT] = await Promise.all([
    getTranslations({ locale, namespace: "ChannelPage" }),
    getTranslations({ locale, namespace: "ChannelsPage" }),
  ]);
  const description = t("metaDescription", { name: channel.name });
  const channelUrl = getLocalizedUrl(locale, `/channels/${channel.slug}`);
  const imageUrl = getChannelOpenGraphImageUrl(locale, channel.slug);
  const jsonLd = [
    createChannelJsonLd({
      name: channel.name,
      description,
      url: channelUrl,
      imageUrl,
    }),
    createBreadcrumbJsonLd([
      { name: channelsT("title"), url: getLocalizedUrl(locale, "/channels") },
      { name: channel.name, url: channelUrl },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={createJsonLdScript(jsonLd)} />
      <ChannelPageClient channel={{ ...channel, createdAt: channel.createdAt.toISOString() }} />
    </>
  );
}
