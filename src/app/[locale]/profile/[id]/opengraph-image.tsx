import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getCachedPublicUserById } from "@/lib/services/user";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { TEXT_OG_IMAGE, truncateSeoText, OG_IMAGE_CACHE_CONTROL, OG_IMAGE_FALLBACK_CACHE_CONTROL } from "@/lib/seo";
import { OgImageTemplate } from "@/components/OgImageTemplate";

export const runtime = "nodejs";
export const alt = "Sincere Bhakti profile image";
export const size = { width: TEXT_OG_IMAGE.width, height: TEXT_OG_IMAGE.height };
export const contentType = TEXT_OG_IMAGE.type;

const okInit = { ...size, headers: { "Cache-Control": OG_IMAGE_CACHE_CONTROL } };
const fallbackInit = { ...size, headers: { "Cache-Control": OG_IMAGE_FALLBACK_CACHE_CONTROL } };

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ip = getClientIp(await headers());
  const [metadataT, profileT] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "ProfilePage" }),
  ]);

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readProfileOgImage, ip, RATE_LIMITS.readProfileOgImage.limit, RATE_LIMITS.readProfileOgImage.windowMs)) {
    return new ImageResponse(<OgImageTemplate eyebrow={profileT("title")} title="Sincere Bhakti" />, fallbackInit);
  }

  const user = await getCachedPublicUserById(id);
  if (!user) {
    return new ImageResponse(<OgImageTemplate eyebrow={profileT("title")} title="Sincere Bhakti" />, fallbackInit);
  }

  return new ImageResponse(
    <OgImageTemplate
      eyebrow={profileT("title")}
      title={truncateSeoText(user.name, 54)}
      subtitle={metadataT("profile.description", { name: user.name })}
    />,
    okInit,
  );
}
