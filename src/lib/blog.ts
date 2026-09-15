import { extractPlainText } from "@/lib/rich-text";

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
 * A row is publicly visible when flagged public and its publish date has
 * passed. Accepts Date or ISO-string publish dates (API responses serialize
 * Dates to strings). Timeline promos of scheduled articles carry the
 * article's publish date so the two go live together; null means immediately
 * visible. Channel authors additionally see their own non-public rows —
 * callers OR this with their manage check.
 */
export function isPubliclyVisible(
  post: { isPublic: boolean; publishedAt: Date | string | null },
  now = new Date(),
): boolean {
  if (!post.isPublic) return false;
  if (!post.publishedAt) return true;
  const publishedAt = post.publishedAt instanceof Date ? post.publishedAt : new Date(post.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return false;
  return publishedAt <= now;
}

// Aliases kept so existing importers keep working.
export const isBlogPubliclyVisible = isPubliclyVisible;
export const isPostPubliclyVisible = isPubliclyVisible;

/**
 * Whether the viewer may manage (edit/delete) a blog article: the channel
 * owner, or a channel in their manageable set. Pure helper kept out of
 * components for unit testing.
 */
export function isBlogPostManager(
  post: { channel: { id: string; ownerId: string } },
  currentUserId?: string,
  manageableChannelIds?: string[],
): boolean {
  return Boolean(currentUserId === post.channel.ownerId || manageableChannelIds?.includes(post.channel.id));
}

export interface TimelinePostBody {
  channelId: string;
  language: string;
  isPublic: boolean;
  blogPostId: string;
  publishedAt?: string;
}

/**
 * Build the feed-post body promoting a blog article in the posts timeline.
 * The promo inherits channel, language, visibility, and publish date from
 * the article and carries no text of its own — the card renders the article
 * excerpt instead. A scheduled article yields a scheduled promo (same date),
 * so both go live together instead of the promo leaking an empty card early.
 */
export function buildTimelinePostBody(blog: {
  id: string;
  channel: { id: string };
  language: string;
  isPublic: boolean;
  publishedAt: Date | string | null;
}): TimelinePostBody {
  return {
    channelId: blog.channel.id,
    language: blog.language,
    isPublic: blog.isPublic,
    blogPostId: blog.id,
    ...(blog.publishedAt
      ? { publishedAt: blog.publishedAt instanceof Date ? blog.publishedAt.toISOString() : blog.publishedAt }
      : {}),
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

/**
 * Snapshot of the blog composer fields compared for unsaved-changes
 * detection. Content is compared by normalized form (see below); a picked
 * cover file is tracked separately since a File has no URL yet.
 */
export interface BlogDraftSnapshot {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string;
  hasCoverFile: boolean;
  categories: string[];
  isPublic: boolean;
  publishedAt: string;
}

/**
 * Whether the composer differs from its last saved state. Text fields compare
 * trimmed; bodies compare by plain text when either side is text-empty (an
 * empty Tiptap doc serializes differently from "" but means the same), and
 * raw otherwise so formatting-only edits still count as changes.
 */
export function isBlogDraftDirty(current: BlogDraftSnapshot, saved: BlogDraftSnapshot): boolean {
  if (current.title.trim() !== saved.title.trim()) return true;
  if (current.slug.trim() !== saved.slug.trim()) return true;
  if (current.excerpt.trim() !== saved.excerpt.trim()) return true;
  const currentBody = extractPlainText(current.content).trim() ? current.content : "";
  const savedBody = extractPlainText(saved.content).trim() ? saved.content : "";
  if (currentBody !== savedBody) return true;
  if (current.coverUrl.trim() !== saved.coverUrl.trim()) return true;
  if (current.hasCoverFile !== saved.hasCoverFile) return true;
  if (current.categories.join("\0") !== saved.categories.join("\0")) return true;
  if (current.isPublic !== saved.isPublic) return true;
  if (current.publishedAt !== saved.publishedAt) return true;
  return false;
}
