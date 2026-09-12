import type { Metadata } from "next";
import { headers } from "next/headers";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Image as ImageIcon, Users } from "lucide-react";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import { getBlogPosts } from "@/lib/services/blog";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import BlogCard from "@/components/BlogCard";
import type { BlogPost } from "@/types/blog";

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
	const allowed = await checkRateLimit(
		RATE_LIMIT_PREFIX.readBlogs,
		ip,
		RATE_LIMITS.readBlogs.limit,
		RATE_LIMITS.readBlogs.windowMs,
	);
	let blogPosts: BlogPost[] = [];
	if (allowed) {
		try {
			const result = await getBlogPosts({
				scope: "public",
				language: locale,
				requestLanguage: locale,
				limit: 3,
			});
			blogPosts = JSON.parse(JSON.stringify(result.posts)) as BlogPost[];
		} catch {
			blogPosts = [];
		}
	}

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
					<h1 className="text-4xl md:text-5xl font-medium text-deep-brass leading-tight mb-4 text-balance">
						&ldquo;{t("subtitle")}&rdquo;
					</h1>
					<p className="text-lg text-deep/60 mb-8 max-w-xl">
						{t("description")}
					</p>
					<div className="flex flex-wrap justify-center gap-4">
						<Button href="/register" variant="default" size="hero">
							{t("ctaJoin")}
						</Button>
						<Button href="/posts" variant="outline-deep" size="hero" className="text-deep-brass">
							{t("ctaPosts")}
						</Button>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
					<Card variant="flat">
						<Heart className="mb-3 text-deep-brass" size={28} aria-hidden="true" />
						<h3 className="text-lg font-semibold text-deep-brass mb-2">{t("cardBhaktiTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardBhaktiDesc")}</p>
					</Card>
					<Card variant="flat">
						<ImageIcon className="mb-3 text-deep-brass" size={28} aria-hidden="true" />
						<h3 className="text-lg font-semibold text-deep-brass mb-2">{t("cardMediaTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardMediaDesc")}</p>
					</Card>
					<Card variant="flat">
						<Users className="mb-3 text-deep-brass" size={28} aria-hidden="true" />
						<h3 className="text-lg font-semibold text-deep-brass mb-2">{t("cardSangaTitle")}</h3>
						<p className="text-sm text-deep/60">{t("cardSangaDesc")}</p>
					</Card>
				</div>

				{blogPosts.length > 0 ? (
					<section className="mt-16 text-left" aria-labelledby="home-blog-heading">
						<div className="flex items-baseline justify-between gap-4 mb-2">
							<h2 id="home-blog-heading" className="text-2xl font-bold text-deep">
								{t("blogLatestTitle")}
							</h2>
							<Link
								href="/blog"
								className="shrink-0 text-sm font-medium text-saffron hover:text-saffron-dark transition-colors"
							>
								{t("viewAllBlog")} →
							</Link>
						</div>
						<p className="text-sm text-deep/60 mb-6">{t("blogLatestSubtitle")}</p>
						<div className="space-y-4">
							{blogPosts.map((post) => (
								<BlogCard key={post.id} post={post} />
							))}
						</div>
					</section>
				) : null}
			</div>
		</div>
	);
}
