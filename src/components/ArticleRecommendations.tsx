"use client";

import { useId } from "react";
import { Link } from "@/i18n/navigation";
import BlogCard from "@/components/BlogCard";
import { isBlogPubliclyVisible, selectLatestBlogPosts } from "@/lib/blog";
import type { BlogPost } from "@/types/blog";

export default function ArticleRecommendations({ title, posts, currentPostId, href, linkLabel }: {
  title: string;
  posts: BlogPost[];
  currentPostId: string;
  href: string;
  linkLabel: string;
}) {
  const headingId = useId();
  const visible = selectLatestBlogPosts(posts.filter(post => isBlogPubliclyVisible(post)), currentPostId);
  if (!visible.length) return null;
  return (
    <section className="article-recommendations" aria-labelledby={headingId}>
      <h2 id={headingId} className="font-heading article-recommendations-heading">{title}</h2>
      <div>{visible.map(post => <BlogCard key={post.id} post={post} variant="compact" />)}</div>
      <Link href={href} className="article-recommendations-more">{linkLabel}<span aria-hidden="true"> →</span></Link>
    </section>
  );
}
