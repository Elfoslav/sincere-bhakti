import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getCachedAlbumByShortId } from "@/lib/services/album";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { TEXT_OG_IMAGE, truncateSeoText, OG_IMAGE_CACHE_CONTROL, OG_IMAGE_FALLBACK_CACHE_CONTROL, OG_IMAGE_RATE_LIMITED_CACHE_CONTROL } from "@/lib/seo";
import { OgImageTemplate } from "@/components/OgImageTemplate";

export const runtime = "nodejs";
export const alt = "Sincere Bhakti gallery album image";
export const size = { width: TEXT_OG_IMAGE.width, height: TEXT_OG_IMAGE.height };
export const contentType = TEXT_OG_IMAGE.type;

const okInit = { ...size, headers: { "Cache-Control": OG_IMAGE_CACHE_CONTROL } };
// Missing album: cacheable for that URL. Rate-limited: transient per-IP, must
// not be shared-cached or it pins the fallback on a real album's card.
const fallbackInit = { ...size, headers: { "Cache-Control": OG_IMAGE_FALLBACK_CACHE_CONTROL } };
const rateLimitedInit = { ...size, headers: { "Cache-Control": OG_IMAGE_RATE_LIMITED_CACHE_CONTROL } };

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; shortId: string }>;
}) {
  const { locale, shortId } = await params;
  const ip = getClientIp(await headers());
  const t = await getTranslations({ locale, namespace: "Gallery" });

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readAlbumOgImage, ip, RATE_LIMITS.readAlbumOgImage.limit, RATE_LIMITS.readAlbumOgImage.windowMs)) {
    return new ImageResponse(<OgImageTemplate eyebrow={t("title")} title="Sincere Bhakti" />, rateLimitedInit);
  }

  const album = await getCachedAlbumByShortId(shortId, locale);
  if (!album || !album.isPublic) {
    return new ImageResponse(<OgImageTemplate eyebrow={t("title")} title="Sincere Bhakti" />, fallbackInit);
  }

  return new ImageResponse(
    <OgImageTemplate
      eyebrow={t("title")}
      title={truncateSeoText(album.title, 54)}
      subtitle={t("itemCount", { count: album.items.length })}
    />,
    okInit,
  );
}
