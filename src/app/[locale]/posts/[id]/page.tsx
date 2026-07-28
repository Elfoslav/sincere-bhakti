import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localeFlags } from "@/i18n/routing";
import { getCachedPostById } from "@/lib/services/post";
import { canAuthorChannel } from "@/lib/services/channel";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import PostDetailClient from "./post-detail-client";
import PostLayout from "@/components/PostLayout";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  POST_OG_IMAGE,
  createBreadcrumbJsonLd,
  createJsonLdScript,
  createPostJsonLd,
  getLocalizedUrl,
  getOpenGraphLocale,
  getPostOpenGraphImageUrl,
  getPostSeoDescription,
  getPostSeoTitle,
} from "@/lib/seo";
import type { Post, MediaType } from "@/types/post";

type Params = { locale: string; id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, id } = await params;

  const post = await getCachedPostById(id, locale);
  if (!post || !post.isPublic) return {};

  const title = getPostSeoTitle(post.channel.name, post.content);
  const description = getPostSeoDescription(post.channel.name, post.content);
  const canonicalUrl = getLocalizedUrl(post.language || locale, `/posts/${id}`);
  const imageUrl = getPostOpenGraphImageUrl(post.language || locale, id);

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
      locale: getOpenGraphLocale(post.language || locale),
      url: canonicalUrl,
      siteName: "Sincere Bhakti",
      images: [{ ...POST_OG_IMAGE, url: imageUrl, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, id } = await params;

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) notFound();

  const [post, session] = await Promise.all([getCachedPostById(id, locale), auth()]);

  if (!post) notFound();
  if (!post.isPublic && (!session?.user?.id || !await canAuthorChannel(post.channel.id, session.user.id))) notFound();

  if (post.language !== locale) {
    const languageName = new Intl.DisplayNames([locale], { type: "language" }).of(post.language) ?? post.language;
    const singlePostT = await getTranslations({ locale, namespace: "SinglePost" });
    const postsT = await getTranslations({ locale, namespace: "PostsPage" });

    const title = getPostSeoTitle(post.channel.name, post.content);
    const description = getPostSeoDescription(post.channel.name, post.content);
    const postUrl = getLocalizedUrl(post.language, `/posts/${id}`);
    const imageUrl = getPostOpenGraphImageUrl(post.language, id);
    const createdAtISO = post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt;

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={createJsonLdScript([
            createPostJsonLd({
              title,
              description,
              url: postUrl,
              imageUrl,
              channelName: post.channel.name,
              content: post.content ?? "",
              createdAt: createdAtISO,
              language: post.language,
            }),
            createBreadcrumbJsonLd([
              { name: postsT("title"), url: getLocalizedUrl(locale, "/posts") },
              { name: title, url: getLocalizedUrl(locale, `/posts/${id}`) },
            ]),
          ])}
        />
        <PostLayout title={singlePostT("title")}>
          <div className="space-y-6">
            <div className="bg-white dark:bg-deep-dark rounded-xl border border-stone/20 p-5">
              <div className="flex items-center gap-3 mb-4">
                {post.channel.avatarUrl ? (
                  <img src={post.channel.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-warm flex items-center justify-center">
                    <span className="text-sm font-medium text-deep/60">{post.channel.name[0]}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{post.channel.name}</p>
                  <p className="text-xs text-deep/40">
                    {localeFlags[post.language]} {languageName}
                  </p>
                </div>
              </div>
              {post.content && (
                <p className="text-sm text-deep/80 whitespace-pre-wrap line-clamp-6">{post.content}</p>
              )}
              {post.media.length > 0 && (
                <p className="text-xs text-deep/40 mt-3">
                  {post.media.length} media item{post.media.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex justify-center">
              <Link
                href={`/posts/${id}`}
                locale={post.language}
                className={cn(buttonVariants({ variant: "outline", size: "default" }))}
              >
                {singlePostT("showInLanguage", { language: languageName })}
              </Link>
            </div>
          </div>
        </PostLayout>
      </>
    );
  }

  const serialized: Post = {
    ...post,
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    media: post.media.map((m) => ({ ...m, type: m.type as MediaType })),
  };
  const title = getPostSeoTitle(post.channel.name, post.content);
  const description = getPostSeoDescription(post.channel.name, post.content);
  const postUrl = getLocalizedUrl(post.language || locale, `/posts/${id}`);
  const imageUrl = getPostOpenGraphImageUrl(post.language || locale, id);
  const postsT = await getTranslations({ locale, namespace: "PostsPage" });
  const jsonLd = [
    createPostJsonLd({
      title,
      description,
      url: postUrl,
      imageUrl,
      channelName: post.channel.name,
      content: post.content,
      createdAt: post.createdAt,
      language: post.language || locale,
    }),
    createBreadcrumbJsonLd([
      { name: postsT("title"), url: getLocalizedUrl(locale, "/posts") },
      { name: title, url: postUrl },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={createJsonLdScript(jsonLd)} />
      <PostDetailClient post={serialized} />
    </>
  );
}
