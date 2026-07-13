import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ChannelsPageClient from "./channels-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ChannelsPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      type: "website",
      images: [{ url: "/images/sincere-bhakti-logo.png", width: 603, height: 414 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: ["/images/sincere-bhakti-logo.png"],
    },
  };
}

export default function ChannelsPage() {
  return <ChannelsPageClient />;
}