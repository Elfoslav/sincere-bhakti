import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Image as ImageIcon, Users } from "lucide-react";

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

export default async function Home({ params }: Props) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("HomePage");

	return (
		<div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-12">
			<div className="max-w-4xl w-full">
				<div className="flex flex-col items-center text-center mb-14">
					<div className="relative mb-6">
						<div
							aria-hidden="true"
							className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(224,138,46,0.07)_0%,rgba(224,138,46,0.025)_45%,transparent_68%)]"
						/>
						<Image
							src="/images/sincere-bhakti-logo.png"
							alt={t("logoAlt")}
							title={t("logoAlt")}
							width={230}
							height={158}
							priority
							className="relative"
							style={{ width: 230, height: 158 }}
						/>
					</div>
					<h1 className="text-4xl md:text-5xl font-medium text-deep leading-tight mb-4 text-balance">
						&ldquo;{t("subtitle")}&rdquo;
					</h1>
					<p className="text-lg text-deep/60 mb-8 max-w-xl">
						{t("description")}
					</p>
					<div className="flex flex-wrap justify-center gap-4">
						<Button href="/register" variant="default" size="hero">
							{t("ctaJoin")}
						</Button>
						<Button href="/posts" variant="outline-deep" size="hero">
							{t("ctaPosts")}
						</Button>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
					<Card variant="flat">
						<Heart className="mb-3 text-deep" size={28} aria-hidden="true" />
						<h3 className="text-lg font-semibold text-deep mb-2">{t("cardBhaktiTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardBhaktiDesc")}</p>
					</Card>
					<Card variant="flat">
						<ImageIcon className="mb-3 text-deep" size={28} aria-hidden="true" />
						<h3 className="text-lg font-semibold text-deep mb-2">{t("cardMediaTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardMediaDesc")}</p>
					</Card>
					<Card variant="flat">
						<Users className="mb-3 text-deep" size={28} aria-hidden="true" />
						<h3 className="text-lg font-semibold text-deep mb-2">{t("cardSangaTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardSangaDesc")}</p>
					</Card>
				</div>
			</div>
		</div>
	);
}
