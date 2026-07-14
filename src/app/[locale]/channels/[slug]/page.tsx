import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveSlugRedirect } from "@/lib/services/channel";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import ChannelPageClient from "./channel-page-client";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "ChannelPage" });

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = await rateLimit(rateLimitKey("read-channel", ip), RATE_LIMITS.readChannel.limit, RATE_LIMITS.readChannel.windowMs);
  if (!allowed) return { title: t("notFound") };

  const channel = await prisma.channel.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!channel) {
    return { title: t("notFound") };
  }

  return {
    title: channel.name,
    description: t("metaDescription", { name: channel.name }),
    openGraph: {
      title: channel.name,
      description: t("metaDescription", { name: channel.name }),
      type: "website",
      images: [{ url: "/images/sincere-bhakti-logo.png", width: 603, height: 414 }],
    },
    twitter: {
      card: "summary_large_image",
      title: channel.name,
      description: t("metaDescription", { name: channel.name }),
      images: ["/images/sincere-bhakti-logo.png"],
    },
  };
}

export default async function ChannelPage({ params }: Props) {
  const { locale, slug } = await params;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = await rateLimit(rateLimitKey("read-channel", ip), RATE_LIMITS.readChannel.limit, RATE_LIMITS.readChannel.windowMs);
  if (!allowed) notFound();

  const channel = await prisma.channel.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      avatarUrl: true,
      createdAt: true,
      ownerId: true,
      isPersonal: true,
      _count: { select: { posts: { where: { isPublic: true } } } },
    },
  });

  if (!channel) {
    const targetSlug = await resolveSlugRedirect(slug);
    if (targetSlug) {
      redirect(`/${locale}/channels/${targetSlug}`);
    }
    notFound();
  }

  const { _count, ...data } = channel;
  return <ChannelPageClient channel={{ ...data, createdAt: data.createdAt.toISOString(), postCount: _count.posts }} />;
}
