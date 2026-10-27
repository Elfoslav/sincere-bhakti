import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import HomeHero from "@/components/HomeHero";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import HomepageBlogSection from "@/components/HomepageBlogSection";

type Props = {
	params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "HomePage" });
	return {
		openGraph: {
			title: t("metaTitle"),
			description: t("metaDescription"),
			images: [DEFAULT_OG_IMAGE],
		},
		twitter: {
			card: "summary_large_image",
			title: t("metaTitle"),
			description: t("metaDescription"),
			images: [DEFAULT_OG_IMAGE.url],
		},
	};
}

export default async function Home({ params }: Props) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("HomePage");

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) notFound();

  return (
    <div>
      <HomeHero />
      <div className="site-container">
        <HomepageBlogSection />
        <section className="home-values" aria-label={t("metaTitle")}>
          {(["Bhakti", "Media", "Sanga"] as const).map((feature) => (
            <div key={feature}>
              <h2 className="font-heading text-2xl">{t(`card${feature}Title`)}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`card${feature}Desc`)}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
