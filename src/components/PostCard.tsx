"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { extractYouTubeContent } from "@/lib/video";

interface PostAuthor {
  id: string;
  name: string | null;
  image: string | null;
}

interface Post {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isPublic: boolean;
  createdAt: string;
  author: PostAuthor;
}

export default function PostCard({
  post,
  onDelete,
  currentUserId,
}: {
  post: Post;
  onDelete?: (id: string) => void;
  currentUserId?: string;
}) {
  const date = new Date(post.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const { cleanContent, embedUrl } = useMemo(
    () => extractYouTubeContent(post.content),
    [post.content],
  );

  const videoEmbed = post.mediaType === "youtube"
    ? post.mediaUrl
    : embedUrl;

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
            {post.author.name || "Anonymous"}
          </Link>
          <p className="text-xs text-deep/60">{date}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/post/${post.id}`}
            className="text-deep/40 hover:text-gold transition-colors p-1"
            title="Open post"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(post.id)}
              className="text-red-500 hover:text-red-700 text-sm p-1"
              title="Delete post"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {cleanContent && (
        <p className="text-deep mb-3 whitespace-pre-wrap">{cleanContent}</p>
      )}

      {videoEmbed && (
        <div className="rounded-lg overflow-hidden mb-2">
          <div className="aspect-video">
            <iframe
              key={videoEmbed}
              src={videoEmbed}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              title="YouTube video"
            />
          </div>
        </div>
      )}

      {!videoEmbed && post.mediaUrl && (
        <div className="rounded-lg overflow-hidden mb-2">
          {post.mediaType === "video" ? (
            <video
              src={post.mediaUrl}
              controls
              className="w-full max-h-96 object-contain"
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt="Post media"
              className="w-full max-h-96 object-contain"
            />
          )}
        </div>
      )}

      {currentUserId === post.author.id && (
        <div className="flex items-center gap-2 text-xs text-deep/50">
          {post.isPublic ? (
            <span className="bg-tulsi/20 text-tulsi px-2 py-0.5 rounded-full">
              Public
            </span>
          ) : (
            <span className="bg-saffron/20 text-saffron-dark px-2 py-0.5 rounded-full">
              Private
            </span>
          )}
        </div>
      )}
    </div>
  );
}
