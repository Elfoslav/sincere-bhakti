import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
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
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-media">
          <Image src="/images/vrindavan-dawn.jpg" alt="" fill sizes="100vw" preload />
        </div>
        <div className="site-container home-hero-content">
          <div className="home-hero-copy reveal-in">
            <h1 id="home-title" className="type-display">{t("logoAlt")}</h1>
            <p className="font-heading home-hero-subtitle mt-4">{t("subtitle")}</p>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground sm:text-lg">{t("heroDescription")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4 sm:gap-6">
              <Button href="/register" size="hero">{t("ctaJoin")}</Button>
              <Button href="/posts" variant="link-foreground" size="hero" icon={<ArrowRight />} iconPosition="end">{t("ctaPosts")}</Button>
            </div>
          </div>
        </div>
      </section>
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
