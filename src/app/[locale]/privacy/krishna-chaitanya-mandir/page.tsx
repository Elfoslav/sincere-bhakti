import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { krishnaChaitanyaMandirPrivacy } from "@/content/krishna-chaitanya-mandir-privacy";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";

type Props = {
	params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "PrivacyPolicy" });
	return {
		title: t("metaTitle"),
		description: t("metaDescription"),
	};
}

export default async function KrishnaChaitanyaMandirPrivacyPage({ params }: Props) {
	const { locale } = await params;
	setRequestLocale(locale);

	const ip = getClientIp(await headers());
	if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPrivacy, ip, RATE_LIMITS.readPrivacy.limit, RATE_LIMITS.readPrivacy.windowMs)) {
		const t = await getTranslations("PrivacyPolicy");
		return <p className="reading-container page-space text-muted-foreground">{t("rateLimited")}</p>;
	}

	const t = await getTranslations("PrivacyPolicy");
	const policy = krishnaChaitanyaMandirPrivacy;

	return (
		<article className="reading-container page-space">
			<header className="mb-10">
				<h1 className="type-title mb-3">{policy.title}</h1>
				<p className="text-xl font-semibold text-deep">{policy.appName}</p>
				<p className="mt-2 text-sm text-muted-foreground">{t("lastUpdated", { date: policy.lastUpdated })}</p>
			</header>

			<div className="space-y-9">
				<section className="space-y-3">
					<h2 className="text-xl font-semibold text-deep">1. Introduction</h2>
					{policy.intro.map((paragraph) => <p className="leading-relaxed text-muted-foreground" key={paragraph}>{paragraph}</p>)}
				</section>

				{policy.sections.map((section) => (
					<section className="space-y-3" key={section.heading}>
						<h2 className="text-xl font-semibold text-deep">{section.heading}</h2>
						{section.paragraphs?.map((paragraph) => <p className="leading-relaxed text-muted-foreground" key={paragraph}>{paragraph}</p>)}
						{section.items && (
							<ul className="space-y-2">
								{section.items.map((item) => <li className="flex gap-3 leading-relaxed text-muted-foreground" key={item}><span className="mt-1.5 shrink-0 leading-none text-saffron">✦</span><span>{item}</span></li>)}
							</ul>
						)}
					</section>
				))}
			</div>

			<div className="mt-12 border-t border-sand pt-6">
				<Link href="/" className="font-medium text-saffron underline-offset-2 hover:text-saffron-dark hover:underline">← {t("backHome")}</Link>
			</div>
		</article>
	);
}
