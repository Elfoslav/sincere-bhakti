import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAlbums } from "@/lib/services/album";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { FEED_DEFAULT_LIMIT } from "@/lib/validation";
import type { Album } from "@/types/album";
import GalleryPageClient from "./gallery-page-client";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

// Render per-request: the first feed page is fetched live from the DB, so this
// must not be statically prerendered at build time. Using headers() in the page
// component already opts into dynamic rendering automatically.

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Gallery" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      type: "website",
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

export default async function GalleryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Rate-limit the SSR feed fetch so abusive/bot traffic hitting
  // /gallery doesn't hammer Prisma directly (the client-side fallback
  // goes through the API route which has its own rate limit).
  const ip = getClientIp(await headers());
  const allowed = await checkRateLimit(RATE_LIMIT_PREFIX.readAlbums, ip, RATE_LIMITS.readAlbums.limit, RATE_LIMITS.readAlbums.windowMs);

  // Fetch the first page of the public feed on the server so it's in the HTML —
  // no hydrate→fetch→render waterfall. JSON round-trip mirrors the API response
  // shape (Date → ISO string) that the client hook expects.
  let initialPublic: { posts: Album[]; hasMore: boolean } | undefined;
  if (allowed) {
    try {
      const result = await getAlbums({ scope: "public", language: locale, requestLanguage: locale, limit: FEED_DEFAULT_LIMIT });
      initialPublic = JSON.parse(JSON.stringify(result)) as { posts: Album[]; hasMore: boolean };
    } catch {
      initialPublic = undefined;
    }
  }

  return <GalleryPageClient initialPublic={initialPublic} />;
}
