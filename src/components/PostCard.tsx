"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ExternalLink } from "lucide-react";
import { extractYouTubeContent } from "@/lib/video";
import type { Post } from "@/types/post";

export default function PostCard({
  post,
  currentUserId,
}: {
  post: Post;
  currentUserId?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("PostCard");
  const date = new Date(post.createdAt).toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const { cleanContent } = useMemo(
    () => extractYouTubeContent(post.content),
    [post.content],
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-5 border border-sand">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-deep font-bold text-lg shrink-0">
          {post.author.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${post.author.id}`}
            className="font-semibold text-deep hover:text-gold"
          >
            {post.author.name || t("anonymous")}
          </Link>
          <p className="text-xs text-deep/60">{date}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/post/${post.id}`}
            className="text-deep/40 hover:text-gold transition-colors p-1"
            title={t("openPost")}
            aria-label={t("openPost")}
          >
            <ExternalLink className="w-4 h-4" />
          </Link>

        </div>
      </div>

      {cleanContent && (
        <p className="text-deep mb-3 whitespace-pre-wrap">{cleanContent}</p>
      )}

      {post.media.map((m) => (
        <div key={m.url} className="rounded-lg overflow-hidden mb-2">
          {m.type === "youtube" ? (
            <div className="aspect-video">
              <iframe
                src={m.url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                title={t("youtubeVideo")}
              />
            </div>
          ) : m.type === "video" ? (
            <video
              src={m.url}
              controls
              className="w-full max-h-96 object-contain"
            />
          ) : m.type === "image" ? (
            <img
              src={m.url}
              alt={t("postMedia")}
              className="w-full max-h-96 object-contain"
            />
          ) : (
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-warm/50 rounded-md border border-sand text-deep hover:bg-warm transition-colors"
            >
              <span className="text-sm">📎</span>
              <span className="text-sm font-medium truncate">{m.url.split("/").pop()}</span>
            </a>
          )}
        </div>
      ))}

      {currentUserId === post.author.id && (
        <div className="flex items-center gap-2 text-xs text-deep/50">
          {post.isPublic ? (
            <span className="bg-tulsi/20 text-tulsi px-2 py-0.5 rounded-full">
              {t("public")}
            </span>
          ) : (
            <span className="bg-saffron/20 text-saffron-dark px-2 py-0.5 rounded-full">
              {t("private")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
