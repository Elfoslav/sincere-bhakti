import { setRequestLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Button } from "@/components/ui/button";

type Props = {
	params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("HomePage");

	return (
		<div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-8">
			<div className="max-w-2xl text-center">
				<h1 className="text-5xl font-bold text-deep mb-4">
					<Image
						src="/images/sincere-bhakti-logo.png"
						alt={t("logoAlt")}
						title={t("logoAlt")}
						width={250}
						height={172}
						className="mx-auto mb-6"
						style={{ width: 250, height: 172 }}
					/>
				</h1>
				<p className="text-xl text-deep/70 mb-2 italic">&ldquo;{t("subtitle")}&rdquo;</p>
				<p className="text-lg text-deep/60 mb-8 max-w-xl mx-auto">{t("description")}</p>

				<div className="flex flex-wrap justify-center gap-4 mb-12">
					<Button href="/register" variant="default" size="hero">
						{t("ctaJoin")}
					</Button>
					<Button href="/posts" variant="outline-deep" size="hero">
						{t("ctaPosts")}
					</Button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
					<div className="bg-white rounded-lg p-6 border border-sand">
						<div className="text-3xl mb-2">📿</div>
						<h3 className="font-semibold text-deep mb-2">{t("cardBhaktiTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardBhaktiDesc")}</p>
					</div>
					<div className="bg-white rounded-lg p-6 border border-sand">
						<div className="text-3xl mb-2">🌺</div>
						<h3 className="font-semibold text-deep mb-2">{t("cardMediaTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardMediaDesc")}</p>
					</div>
					<div className="bg-white rounded-lg p-6 border border-sand">
						<div className="text-3xl mb-2">🤝</div>
						<h3 className="font-semibold text-deep mb-2">{t("cardSangaTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardSangaDesc")}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
