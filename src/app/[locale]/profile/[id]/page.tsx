import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ProfileContent from "@/components/ProfileContent";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { getCachedPublicUserById } from "@/lib/services/user";
import {
  DEFAULT_OG_IMAGE,
  createBreadcrumbJsonLd,
  createJsonLdScript,
  createProfileJsonLd,
  getCanonicalAlternates,
  getJsonLdImageUrl,
  getLocalizedUrl,
  getOpenGraphLocale,
  getSeoImageUrl,
} from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const user = await getCachedPublicUserById(id);
  if (!user) return {};

  const t = await getTranslations({ locale, namespace: "Metadata" });
  const description = t("profile.description", { name: user.name });
  const imageUrl = getSeoImageUrl(user.image);
  const alternates = getCanonicalAlternates(locale, `/profile/${id}`);

  return {
    title: user.name,
    description,
    alternates,
    openGraph: {
      title: user.name,
      description,
      type: "profile",
      locale: getOpenGraphLocale(locale),
      url: alternates?.canonical as string,
      siteName: "Sincere Bhakti",
      images: [{ ...DEFAULT_OG_IMAGE, url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: user.name,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ProfileByIdPage({ params }: Props) {
  const { locale, id } = await params;

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readProfile, ip, RATE_LIMITS.readProfile.limit, RATE_LIMITS.readProfile.windowMs)) notFound();

  const user = await getCachedPublicUserById(id);
  if (!user) notFound();

  const t = await getTranslations({ locale, namespace: "Metadata" });
  const description = t("profile.description", { name: user.name });
  const profileUrl = getLocalizedUrl(locale, `/profile/${id}`);
  const imageUrl = getJsonLdImageUrl(user.image);
  const jsonLd = [
    createProfileJsonLd({
      name: user.name,
      description,
      url: profileUrl,
      imageUrl,
    }),
    createBreadcrumbJsonLd([
      { name: user.name, url: profileUrl },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={createJsonLdScript(jsonLd)} />
      <ProfileContent authorId={id} />
    </>
  );
}
