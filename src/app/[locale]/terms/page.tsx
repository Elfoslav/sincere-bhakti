import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type Props = {
	params: Promise<{ locale: string }>;
};

type Section = { heading: string; body?: string; items?: string[] };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "Terms" });
	return {
		title: t("metaTitle"),
		description: t("metaDescription"),
	};
}

export default async function TermsPage({ params }: Props) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("Terms");
	const sections = t.raw("sections") as Section[];

	return (
		<div className="reading-container page-space">
			<h1 className="type-title mb-3">{t("title")}</h1>
			<p className="text-sm text-muted-foreground mb-8">{t("lastUpdated")}</p>
			<p className="text-deep/80 leading-relaxed mb-10">{t("intro")}</p>

			<div className="space-y-9">
				{sections.map((section, i) => (
					<section key={i}>
						<h2 className="text-xl font-semibold text-deep mb-3">{section.heading}</h2>
						{section.body && (
							<p className="text-muted-foreground leading-relaxed">{section.body}</p>
						)}
						{section.items && (
							<ul className="mt-3 space-y-2">
								{section.items.map((item, j) => (
									<li key={j} className="flex gap-3 text-muted-foreground">
										<span className="text-saffron mt-1.5 shrink-0 leading-none">✦</span>
										<span className="leading-relaxed">{item}</span>
									</li>
								))}
							</ul>
						)}
					</section>
				))}
			</div>

			<div className="mt-12 pt-6 border-t border-sand">
				<Link
					href="/"
					className="text-saffron hover:text-saffron-dark font-medium underline-offset-2 hover:underline"
				>
					← {t("backHome")}
				</Link>
			</div>
		</div>
	);
}
