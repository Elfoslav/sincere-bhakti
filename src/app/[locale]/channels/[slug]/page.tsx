import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ChannelPageClient from "./channel-page-client";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "ChannelPage" });

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
  const { slug } = await params;

  const channel = await prisma.channel.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      avatarUrl: true,
      createdAt: true,
      ownerId: true,
      _count: { select: { posts: true } },
    },
  });

  if (!channel) notFound();

  const { _count, ...data } = channel;
  return <ChannelPageClient channel={{ ...data, createdAt: data.createdAt.toISOString(), postCount: _count.posts }} />;
}
