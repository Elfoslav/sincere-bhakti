import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getCachedChannelBySlug } from "@/lib/services/channel";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { TEXT_OG_IMAGE, truncateSeoText, OG_IMAGE_CACHE_CONTROL, OG_IMAGE_FALLBACK_CACHE_CONTROL, OG_IMAGE_RATE_LIMITED_CACHE_CONTROL } from "@/lib/seo";
import { OgImageTemplate } from "@/components/OgImageTemplate";

export const runtime = "nodejs";
export const alt = "Sincere Bhakti channel image";
export const size = { width: TEXT_OG_IMAGE.width, height: TEXT_OG_IMAGE.height };
export const contentType = TEXT_OG_IMAGE.type;

const okInit = { ...size, headers: { "Cache-Control": OG_IMAGE_CACHE_CONTROL } };
// Missing channel: cacheable for that URL. Rate-limited: transient per-IP, must
// not be shared-cached or it pins the fallback on a real channel's card.
const fallbackInit = { ...size, headers: { "Cache-Control": OG_IMAGE_FALLBACK_CACHE_CONTROL } };
const rateLimitedInit = { ...size, headers: { "Cache-Control": OG_IMAGE_RATE_LIMITED_CACHE_CONTROL } };

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const ip = getClientIp(await headers());
  const t = await getTranslations({ locale, namespace: "ChannelPage" });

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readChannelOgImage, ip, RATE_LIMITS.readChannelOgImage.limit, RATE_LIMITS.readChannelOgImage.windowMs)) {
    return new ImageResponse(<OgImageTemplate eyebrow={t("channelLabel")} title="Sincere Bhakti" />, rateLimitedInit);
  }

  const channel = await getCachedChannelBySlug(slug);
  if (!channel) {
    return new ImageResponse(<OgImageTemplate eyebrow={t("channelLabel")} title="Sincere Bhakti" />, fallbackInit);
  }

  return new ImageResponse(
    <OgImageTemplate
      eyebrow={t("channelLabel")}
      title={truncateSeoText(channel.name, 54)}
      subtitle={t("metaDescription", { name: channel.name })}
    />,
    okInit,
  );
}
