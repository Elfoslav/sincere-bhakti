import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getCachedPublicUserById } from "@/lib/services/user";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { POST_OG_IMAGE, truncateSeoText } from "@/lib/seo";
import { OgImageTemplate } from "@/components/OgImageTemplate";

export const runtime = "nodejs";
export const alt = "Sincere Bhakti profile image";
export const size = { width: POST_OG_IMAGE.width, height: POST_OG_IMAGE.height };
export const contentType = POST_OG_IMAGE.type;

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

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readProfile, ip, RATE_LIMITS.readProfile.limit, RATE_LIMITS.readProfile.windowMs)) {
    return new ImageResponse(<OgImageTemplate eyebrow={profileT("title")} title="Sincere Bhakti" />, size);
  }

  const user = await getCachedPublicUserById(id);
  if (!user) {
    return new ImageResponse(<OgImageTemplate eyebrow={profileT("title")} title="Sincere Bhakti" />, size);
  }

  return new ImageResponse(
    <OgImageTemplate
      eyebrow={profileT("title")}
      title={truncateSeoText(user.name, 54)}
      subtitle={metadataT("profile.description", { name: user.name })}
    />,
    size,
  );
}
