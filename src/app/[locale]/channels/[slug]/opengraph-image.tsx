import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getCachedChannelBySlug } from "@/lib/services/channel";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { POST_OG_IMAGE, truncateSeoText } from "@/lib/seo";
import { OgImageTemplate } from "@/components/OgImageTemplate";

export const runtime = "nodejs";
export const alt = "Sincere Bhakti channel image";
export const size = { width: POST_OG_IMAGE.width, height: POST_OG_IMAGE.height };
export const contentType = POST_OG_IMAGE.type;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const ip = getClientIp(await headers());
  const t = await getTranslations({ locale, namespace: "ChannelPage" });

  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readChannel, ip, RATE_LIMITS.readChannel.limit, RATE_LIMITS.readChannel.windowMs)) {
    return new ImageResponse(<OgImageTemplate eyebrow={t("channelLabel")} title="Sincere Bhakti" />, size);
  }

  const channel = await getCachedChannelBySlug(slug);
  if (!channel) {
    return new ImageResponse(<OgImageTemplate eyebrow={t("channelLabel")} title="Sincere Bhakti" />, size);
  }

  return new ImageResponse(
    <OgImageTemplate
      eyebrow={t("channelLabel")}
      title={truncateSeoText(channel.name, 54)}
      subtitle={t("metaDescription", { name: channel.name })}
    />,
    size,
  );
}
