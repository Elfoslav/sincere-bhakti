/**
 * Format a Date/ISO string for <input type="datetime-local"> (local time,
 * `YYYY-MM-DDTHH:mm`). Pure helper kept out of components for unit testing.
 */
export function toDateTimeLocalValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parse a datetime-local input value back to a Date, or undefined when empty.
 * Returns undefined (not Invalid Date) for blank/invalid input so Zod's
 * optional coercion stays clean.
 */
export function parseDateTimeLocalValue(value: string): Date | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * A blog article is publicly visible when flagged public and its publish
 * date has passed. Accepts Date or ISO-string publish dates (API responses
 * serialize Dates to strings). Channel authors additionally see their own
 * non-public articles — callers OR this with their manage check.
 */
export function isBlogPubliclyVisible(
  post: { isPublic: boolean; publishedAt: Date | string | null },
  now = new Date(),
): boolean {
  if (!post.isPublic) return false;
  if (!post.publishedAt) return true;
  const publishedAt = post.publishedAt instanceof Date ? post.publishedAt : new Date(post.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return false;
  return publishedAt <= now;
}

export interface TimelinePostBody {
  channelId: string;
  language: string;
  isPublic: boolean;
  blogPostId: string;
}

/**
 * Build the feed-post body promoting a blog article in the posts timeline.
 * The promo inherits channel, language, and visibility from the article and
 * carries no text of its own — the card renders the article excerpt instead.
 */
export function buildTimelinePostBody(blog: {
  id: string;
  channel: { id: string };
  language: string;
  isPublic: boolean;
}): TimelinePostBody {
  return {
    channelId: blog.channel.id,
    language: blog.language,
    isPublic: blog.isPublic,
    blogPostId: blog.id,
  };
}

/**
 * How many newest articles the blog detail page surfaces below the article.
 * Kept in one place so the server fetch limit and the client section stay
 * in sync.
 */
export const LATEST_BLOG_POSTS_LIMIT = 3;

/**
 * Pick the newest articles for the detail-page footer: exclude the article
 * being viewed and cap the list at `LATEST_BLOG_POSTS_LIMIT`. The input is
 * already newest-first (service orders by publishedAt/createdAt), so no
 * re-sorting here.
 */
export function selectLatestBlogPosts<T extends { id: string }>(
  posts: T[],
  currentId: string,
  limit: number = LATEST_BLOG_POSTS_LIMIT,
): T[] {
  return posts.filter((post) => post.id !== currentId).slice(0, limit);
}

/**
 * Format a blog article date for display. Accepts Date or ISO-string input
 * (API responses serialize Dates to strings) and falls back to "en-US" for
 * the "en" locale so month names stay in English.
 */
export function formatBlogDate(
  value: Date | string | null | undefined,
  locale: string,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
