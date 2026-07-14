import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPosts } from "@/lib/services/post";
import type { Post } from "@/types/post";
import PostsPageClient from "./posts-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

// Render per-request: the first feed page is fetched live from the DB, so this
// must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PostsPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      type: "website",
      images: [{ url: "/images/sincere-bhakti-logo.png", width: 603, height: 414 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: ["/images/sincere-bhakti-logo.png"],
    },
  };
}

export default async function PostsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Fetch the first page of the public feed on the server so it's in the HTML —
  // no hydrate→fetch→render waterfall. JSON round-trip mirrors the API response
  // shape (Date → ISO string) that the client hook expects.
  let initialPublic: { posts: Post[]; hasMore: boolean } | undefined;
  try {
    const result = await getPosts({ scope: "public", language: locale, limit: 10 });
    initialPublic = JSON.parse(JSON.stringify(result)) as { posts: Post[]; hasMore: boolean };
  } catch {
    initialPublic = undefined;
  }

  return <PostsPageClient initialPublic={initialPublic} />;
}
