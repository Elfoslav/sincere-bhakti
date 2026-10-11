import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCachedAlbumById, getCachedAlbumByShortId } from "@/lib/services/album";
import { canAuthorChannel } from "@/lib/services/channel";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import AlbumDetailClient from "../album-detail-client";
import { getAlbumUrl, getStaleAlbumSlugRedirect } from "@/lib/album-url";
import {
  TEXT_OG_IMAGE,
  createBreadcrumbJsonLd,
  createJsonLdScript,
  getLocalizedPath,
  getLocalizedUrl,
  getOpenGraphLocale,
  getAlbumOpenGraphImageUrl,
  getAlbumSeoDescription,
  getAlbumSeoTitle,
} from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import type { Album } from "@/types/album";

type Params = { locale: string; shortId: string; slug?: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, shortId } = await params;

  const album = await getCachedAlbumByShortId(shortId, locale);
  if (!album || !album.isPublic) return {};

  const title = getAlbumSeoTitle(album.channel.name, album.title);
  const description = getAlbumSeoDescription(album.channel.name, album.description);
  const canonicalUrl = getLocalizedUrl(album.language || locale, getAlbumUrl(album.shortId, album.slug));
  const imageUrl = getAlbumOpenGraphImageUrl(album.language || locale, album.shortId);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "article",
      locale: getOpenGraphLocale(album.language || locale),
      url: canonicalUrl,
      siteName: "Sincere Bhakti",
      images: [{ ...TEXT_OG_IMAGE, url: imageUrl, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, shortId, slug } = await params;

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readAlbums, ip, RATE_LIMITS.readAlbums.limit, RATE_LIMITS.readAlbums.windowMs)) notFound();

  const [session] = await Promise.all([auth()]);

  // eslint-disable-next-line prefer-const
  let album = await getCachedAlbumByShortId(shortId, locale);

  // Backward compatibility: if not found by shortId, try by full ID and redirect
  if (!album) {
    const oldAlbum = await getCachedAlbumById(shortId, locale);
    if (oldAlbum) {
      redirect(getLocalizedPath(oldAlbum.language, getAlbumUrl(oldAlbum.shortId, oldAlbum.slug)));
    }
  }

  if (!album) notFound();
  if (!album.isPublic && (!session?.user?.id || !await canAuthorChannel(album.channel.id, session.user.id))) notFound();

  // Canonical slug enforcement: looked up by permanent shortId, so a stale
  // slug segment still resolves here — redirect it to the current slug.
  const staleSlugRedirect = getStaleAlbumSlugRedirect(slug?.join("/"), album.shortId, album.slug);
  if (staleSlugRedirect) {
    redirect(getLocalizedPath(locale, staleSlugRedirect));
  }

  const serialized: Album = {
    ...album,
    createdAt: album.createdAt instanceof Date ? album.createdAt.toISOString() : album.createdAt,
    updatedAt: album.updatedAt instanceof Date ? album.updatedAt.toISOString() : album.updatedAt,
  };
  const title = getAlbumSeoTitle(album.channel.name, album.title);
  const t = await getTranslations({ locale, namespace: "Gallery" });
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ImageGallery",
      headline: title,
      description: getAlbumSeoDescription(album.channel.name, album.description),
      url: getLocalizedUrl(album.language || locale, getAlbumUrl(album.shortId, album.slug)),
      author: { "@type": "Organization", name: album.channel.name },
    },
    createBreadcrumbJsonLd([
      { name: t("title"), url: getLocalizedUrl(locale, "/gallery") },
      { name: title, url: getLocalizedUrl(album.language || locale, getAlbumUrl(album.shortId, album.slug)) },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={createJsonLdScript(jsonLd)} />
      <AlbumDetailClient album={serialized} />
    </>
  );
}
