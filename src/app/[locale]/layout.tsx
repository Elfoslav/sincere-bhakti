import SiteLayout from "@/components/SiteLayout";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/url";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

const siteUrl = getSiteUrl();

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Omit<Props, "children">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: {
      default: t("home.title"),
      template: "%s | Sincere Bhakti",
    },
    description: t("home.description"),
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: "website" as const,
      siteName: "Sincere Bhakti",
      url: siteUrl,
      locale: locale === "en" ? "en_US" : locale === "cs" ? "cs_CZ" : "sk_SK",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image" as const,
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      languages: {
        en: siteUrl,
        cs: `${siteUrl}/cs`,
        sk: `${siteUrl}/sk`,
      },
    },
    icons: {
      icon: "/favicon.ico",
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  return <SiteLayout locale={locale}>{children}</SiteLayout>;
}
