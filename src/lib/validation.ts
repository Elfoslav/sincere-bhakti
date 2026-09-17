import { z } from "zod";
import { locales } from "@/i18n/routing";
import { extractPlainText } from "@/lib/rich-text";
import { CHANNEL_MEMBER_ACTIONS, CHANNEL_MEMBER_ROLES } from "@/lib/channel-roles";
import { tokenizeUrls } from "@/lib/autolink";

export const PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_SALT_ROUNDS = 12;
export const NAME_MAX_LENGTH = 50;
export const MAX_RENAME_COUNT = 3;
// Max length of a post's URL slug (derived from its content). Kept in the
// SEO-friendly ~50-60 range; the permanent shortId is the real identifier, so
// the slug is cosmetic. Must stay in sync with the slug backfill in
// prisma/migrations/20260728120000_add_post_shortid_slug.
export const POST_SLUG_MAX_LENGTH = 60;
export const POST_LINK_TITLE_MAX_LENGTH = 200;

// Blog post field limits. Titles stay short for cards/SEO; excerpts feed list
// previews and meta descriptions; content allows long-form articles. Slugs
// share the title's length so a fully slugified title is never truncated.
export const BLOG_TITLE_MAX_LENGTH = 100;
export const BLOG_SLUG_MAX_LENGTH = BLOG_TITLE_MAX_LENGTH;
export const BLOG_EXCERPT_MAX_LENGTH = 300;
export const BLOG_CONTENT_MAX_LENGTH = 20000;
// Stored-content cap: article bodies are Tiptap JSON documents, so the raw
// string carries markup overhead. The human-readable limit above is enforced
// separately on the extracted plain text.
export const BLOG_RAW_CONTENT_MAX_LENGTH = 60000;

// Shared feed/picker bounds so SSR fetches, Zod schemas, and client hooks
// stay in sync instead of hardcoding the same numbers in many places.
export const FEED_DEFAULT_LIMIT = 10;
export const FEED_MAX_LIMIT = 50;
export const MAX_MEDIA_ITEMS_PER_POST = 10;
export const MEDIA_URL_MAX_LENGTH = 2000;
export const CATEGORY_SEARCH_LIMIT = 10;
// Upper bound for picker searches. Decoupled from the feed page size above:
// the picker taxonomy and the post feed scale independently.
export const CATEGORY_SEARCH_MAX_LIMIT = 50;
// Shared debounce for search inputs (category picker, channel search).
export const SEARCH_DEBOUNCE_MS = 300;

// Cuid-shaped entity ids (posts, blogs, drafts, R2 key namespaces): the same
// charset everywhere, rejecting `/`, `..`, `?`, `#` that could escape a key
// prefix — and so arbitrary strings can't be used as existence oracles via
// id filters. Replaces the former per-schema copies and uploadPostIdField.
export const entityIdField = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

// Shared user-input fragments so the same shapes stay identical in every
// schema instead of re-declaring the same chain per form.
export const emailField = z.string().trim().toLowerCase().email().max(255);
export const passwordField = z.string().trim().min(PASSWORD_MIN_LENGTH).max(128);
export const nameField = z.string().trim().min(1).max(NAME_MAX_LENGTH);
export const fileNameField = z.string().min(1).max(255);
export const uploadContentTypeField = z.string().min(1).max(255).refine(isAllowedUploadContentType);
export const safeUrlField = z.string().url().max(MEDIA_URL_MAX_LENGTH).refine(isSafeHttpUrl);
export const publishedAtNullableField = z.coerce.date().nullish();

// Unified category taxonomy: one global tag list for timeline posts and blog
// articles. Names are forced to Title Case (multi-word allowed) and unique
// across the whole app; the per-post cap keeps tag spam in check.
export const CATEGORY_NAME_MAX_LENGTH = 50;
export const CATEGORIES_MAX_PER_POST = 5;

// Single category name from user input: trimmed and length-checked raw,
// then normalized (parsed output is the canonical Title Case form, so
// downstream code receives clean values without re-normalizing).
const categoryNameField = z
  .string()
  .trim()
  .min(1)
  .max(CATEGORY_NAME_MAX_LENGTH)
  .transform((v) => normalizeCategoryName(v));

// Category name list for post/blog writes: capped, with duplicates rejected
// AFTER normalization ("Bhakti" + "BHAKTI" counts as a duplicate).
const categoryNamesField = z
  .array(categoryNameField)
  .max(CATEGORIES_MAX_PER_POST)
  .refine((names) => new Set(names).size === names.length);

export const categorySearchSchema = z.object({
  search: z.string().trim().max(CATEGORY_NAME_MAX_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(CATEGORY_SEARCH_MAX_LIMIT).default(CATEGORY_SEARCH_LIMIT),
  // Picker scope: categories only ever surface in their own language.
  language: z.enum(locales).optional(),
});

export const createCategorySchema = z.object({
  name: categoryNameField,
  language: z.enum(locales).default("en"),
});

// Only http(s) URLs are allowed for user-supplied media. This blocks
// dangerous schemes like `javascript:` and `data:` that would otherwise
// pass a bare `.url()` check and become a stored-XSS vector when rendered
// in an <a href>/<img src>/<iframe src>.
export function isSafeHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Validates that a media URL originates from the app's own storage domain
// or from YouTube (the only trusted embed source). This prevents users from
// embedding arbitrary external URLs in posts.
export function isTrustedMediaUrl(
  url: string,
  type: string,
  storageDomain: string,
): boolean {
  try {
    const parsed = new URL(url);
    if (type === "youtube") {
      return parsed.origin === "https://www.youtube.com" && parsed.pathname.startsWith("/embed/");
    }
    const allowed = new URL(storageDomain);
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}

// Uploads are restricted to common web-safe formats.
// SVG is excluded because of stored-XSS risk (inline scripts in SVGs).
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/ogg",
] as const;

export function isAllowedUploadContentType(contentType: string): boolean {
  return (ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(contentType);
}

// Build a comma-separated accept string for <input accept> that stays in sync
// with the allowed types list. This avoids drift between the file picker filter
// and server-side validation.
export function getAcceptString(): string {
  return ALLOWED_UPLOAD_CONTENT_TYPES.join(",");
}

// Image-only accept string for cover pickers (blog covers never accept
// video). Derived from the same allowlist so the picker can't drift.
export function getImageAcceptString(): string {
  return ALLOWED_UPLOAD_CONTENT_TYPES.filter((t) => t.startsWith("image/")).join(",");
}

// Max upload size (bytes), per media type. Enforced client-side before
// requesting a presigned URL (the file goes browser→R2 directly, so this is
// a UX guard, not server-side enforcement). Videos use a single presigned
// PUT; 200 MB is a safe ceiling for that flow — larger files need multipart.
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_TOTAL_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

// Server-side: longest edge capped at 2048px. Client pre-resizes to this
// so small uploads pass through; server re-resizes anything larger as a
// safety net (bypassing client-side checks).
export const MAX_IMAGE_DIMENSION = 2048;

// Hard ceiling on the DECODED pixel count sharp will accept, to stop
// decompression bombs (a few-MB highly-compressible PNG that expands to
// hundreds of megapixels → OOM). Well above any real photo (~50 MP) but far
// below sharp's ~268 MP default. Passed as `limitInputPixels` wherever sharp
// decodes user-supplied bytes; sharp throws when exceeded.
export const MAX_IMAGE_INPUT_PIXELS = 50_000_000;

// JPEG quality for image re-encoding. 70 is a good balance between visual
// quality and file size — typically 5-10x smaller than the original JPEG
// with no perceptible difference at web viewing sizes.
export const IMAGE_JPEG_QUALITY = 70;

// Image formats that skip client-side canvas resize because the conversion to
// JPEG would lose data (e.g. transparency in PNG, alpha in WebP/AVIF). These
// are instead resized server-side by Sharp during /api/compress.
export const SKIP_CLIENT_RESIZE = ["image/png", "image/webp", "image/avif"];

// Resolve the size limit for a given content type. Uploads are restricted to
// image/* and video/* (see isAllowedUploadContentType); anything else falls
// back to the stricter image limit.
export function maxUploadSizeForContentType(contentType: string): number {
  return contentType.startsWith("video/")
    ? MAX_VIDEO_SIZE_BYTES
    : MAX_IMAGE_SIZE_BYTES;
}

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  terms: z
    .literal(true, { message: "terms_required" }),
  language: z.enum(locales).optional(),
});

// Intrinsic pixel dimensions are optional metadata detected client-side. They
// are used to pick a horizontal image for Open Graph previews and can drive
// layout sizing. Capped to a sane maximum to reject bogus values.
const MAX_MEDIA_DIMENSION = 100_000;

export const mediaItemSchema = z.object({
  url: safeUrlField,
  type: z.enum(["image", "video", "youtube", "file"]),
  width: z.number().int().positive().max(MAX_MEDIA_DIMENSION).optional(),
  height: z.number().int().positive().max(MAX_MEDIA_DIMENSION).optional(),
});

const contentField = z.string().trim().max(5000).optional();
const mediaField = z.array(mediaItemSchema).max(MAX_MEDIA_ITEMS_PER_POST).optional();
const linkTitleField = z.string().trim().min(1).max(POST_LINK_TITLE_MAX_LENGTH).optional();
// Optional publish date input. Accepts ISO date/datetime strings from
// <input type="datetime-local"> (no timezone) or full ISO datetimes; coerced
// to Date. When omitted the server defaults to now (posts) or now (blog).
// Explicit null is treated as omitted (coercion would otherwise turn it into
// the 1970 epoch). Shared by blog articles and timeline posts (promos of
// scheduled articles carry the article's date so both go live together).
const publishedAtField = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.coerce.date().optional(),
);

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createPostSchema = z.object({
  id: z.string().regex(uuidRegex).optional(),
  content: contentField,
  channelId: z.string().optional(),
  media: mediaField.default([]),
  isPublic: z.boolean().default(true),
  language: z.enum(locales).default("en"),
  // Optional publish date (timeline promos of scheduled articles carry the
  // article's date so both go live together). Omitted/null = visible now.
  publishedAt: publishedAtField,
  // Optional link to a channel blog article promoted by this post.
  // Entity-shaped so arbitrary strings can't be used as existence oracles
  // via the feed filter.
  blogPostId: entityIdField.optional(),
  // Category names (canonicalized to Title Case by the field transform).
  categories: categoryNamesField.optional(),
  // Optional page title for link-only posts (e.g. YouTube). When content is
  // effectively a bare URL, the slug is derived from this title instead of the
  // `https://...` string. Cosmetic only, so no trust boundary — re-slugified.
  linkTitle: linkTitleField,
}).refine(
  (data) => data.content || data.media.length > 0 || data.blogPostId,
);

export const updatePostSchema = z.object({
  content: z.string().trim().max(5000).nullish(),
  media: mediaField,
  isPublic: z.boolean().optional(),
  language: z.enum(locales).optional(),
  // Scheduled promo date mirrors the promoted article; null clears it.
  publishedAt: publishedAtNullableField,
  blogPostId: entityIdField.nullish(),
  // Undefined leaves categories alone; null or [] clears them.
  categories: categoryNamesField.nullish(),
  linkTitle: linkTitleField.nullish(),
}).refine(
  (data) => {
    // Linking an article counts as content: text/media may be cleared then.
    if (typeof data.blogPostId === "string" && data.blogPostId) return true;
    const clearContent = data.content === null || data.content === "";
    const clearMedia = Array.isArray(data.media) && data.media.length === 0;
    return !(clearContent && clearMedia);
  },
);

const blogTitleField = z.string().trim().min(1).max(BLOG_TITLE_MAX_LENGTH);
// User-supplied blog slugs are permissive on purpose (any 1..100 chars):
// the service normalizes them with deriveBlogSlug so "My Custom Slug!"
// stores as "my-custom-slug" instead of failing validation.
const blogSlugField = z.string().trim().min(1).max(BLOG_SLUG_MAX_LENGTH);
const blogExcerptField = z.string().trim().max(BLOG_EXCERPT_MAX_LENGTH).optional();
// Stored article bodies are Tiptap JSON: cap the raw string for storage, and
// the human-readable plain text for author-facing limits (legacy plain-text
// bodies validate as themselves).
const blogContentField = z.string().trim().max(BLOG_RAW_CONTENT_MAX_LENGTH).optional()
  .refine((v) => v === undefined || extractPlainText(v).length <= BLOG_CONTENT_MAX_LENGTH);
const blogContentHtmlField = z.string().trim().max(BLOG_RAW_CONTENT_MAX_LENGTH).optional();
const blogCoverField = safeUrlField.optional();

export const createBlogPostSchema = z.object({
  id: z.string().regex(uuidRegex).optional(),
  title: blogTitleField,
  slug: blogSlugField.optional(),
  excerpt: blogExcerptField,
  content: blogContentField,
  coverUrl: blogCoverField,
  contentHtml: blogContentHtmlField,
  channelId: z.string().optional(),
  isPublic: z.boolean().default(true),
  language: z.enum(locales).default("en"),
  publishedAt: publishedAtField,
  // Category names (canonicalized to Title Case by the field transform).
  categories: categoryNamesField.optional(),
}).refine((data) => data.content || data.excerpt);

export const updateBlogPostSchema = z.object({
  title: blogTitleField.optional(),
  slug: blogSlugField.nullish(),
  excerpt: z.string().trim().max(BLOG_EXCERPT_MAX_LENGTH).nullish(),
  content: z.string().trim().max(BLOG_RAW_CONTENT_MAX_LENGTH).nullish().refine(
    (v) => v == null || extractPlainText(v).length <= BLOG_CONTENT_MAX_LENGTH,
  ),
  coverUrl: safeUrlField.nullish(),
  contentHtml: z.string().trim().max(BLOG_RAW_CONTENT_MAX_LENGTH).nullish(),
  isPublic: z.boolean().optional(),
  language: z.enum(locales).optional(),
  publishedAt: publishedAtNullableField,
  // Undefined leaves categories alone; null or [] clears them.
  categories: categoryNamesField.nullish(),
}).refine((data) => {
  const clearContent = data.content === null || data.content === "";
  const clearExcerpt = data.excerpt === null || data.excerpt === "";
  // Only reject when the patch explicitly clears both text fields.
  if (data.content === undefined && data.excerpt === undefined) return true;
  return !(clearContent && clearExcerpt);
});

export const updateNameSchema = z.object({
  name: nameField,
});

export const createChannelSchema = z.object({
  name: nameField,
  language: z.string().min(1).max(10).optional(),
});

export const createChannelTranslationSchema = createChannelSchema.extend({
  language: z.string().min(1).max(10),
});

export const addChannelMemberSchema = z.object({
  action: z.enum(CHANNEL_MEMBER_ACTIONS),
  email: emailField,
  role: z.enum(CHANNEL_MEMBER_ROLES),
});

export const paginationSchema = z.object({
  scope: z.enum(["public", "private"]).optional(),
  cursor: z.string().min(1).trim().optional(),
  limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).default(FEED_DEFAULT_LIMIT),
  channelId: z.string().min(1).optional(),
  language: z.enum(locales).optional(),
  // Feed posts promoting a blog article (used by the blog editor to find
  // the article's timeline post). Ignored by the blog feed itself.
  blogPostId: entityIdField.optional(),
  // Canonicalized again server-side; raw user input accepted here.
  category: z.string().trim().max(CATEGORY_NAME_MAX_LENGTH).optional(),
});

// The blog feed never filters by promoting post id — drop the dead param so
// callers can't send it and wonder why it's ignored.
export const blogPaginationSchema = paginationSchema.omit({ blogPostId: true });

// Top-level R2 folders for direct uploads. Blog covers live under `blog/`
// so post tooling never mistakes them for timeline-post media (and orphan
// sweeps can scope by prefix). Allowlisted — never a free-form client string.
export const uploadFolderField = z.enum(["posts", "blog"]).optional().default("posts");

export const uploadUrlSchema = z.object({
  fileName: fileNameField,
  contentType: uploadContentTypeField,
  postId: entityIdField,
  channelId: z.string().min(1).optional(),
  folder: uploadFolderField,
  // Required so the presigned PUT is signed with a ContentLength cap (R2 rejects
  // a larger upload). Prevents unbounded object-size storage/egress abuse.
  contentLength: z.number().int().positive().max(MAX_VIDEO_SIZE_BYTES),
});

export const batchUploadUrlSchema = z.object({
  postId: entityIdField,
  channelId: z.string().min(1).optional(),
  folder: uploadFolderField,
  files: z
    .array(
      z.object({
        fileName: fileNameField,
        contentType: uploadContentTypeField,
        size: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(MAX_MEDIA_ITEMS_PER_POST),
});

export const updateActiveIdentitySchema = z.object({
  channelId: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
  language: z.enum(locales).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: passwordField,
});

export const compressSchema = z.object({
  key: z.string().min(1).max(500),
});

// Folds diacritics to base ASCII via Unicode NFD decomposition, then drops the
// combining marks. Handles Czech/Slovak (ž→z, ě→e, ý→y, …) and IAST/Sanskrit
// (ā→a, ṛ→r, ś→s, ṇ→n, ḥ→h, …). Shared by name normalization and
// slug derivation so both fold diacritics identically.
function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Canonical form for fuzzy-unique name comparison: strips diacritics,
// lowercases, and collapses ALL whitespace runs (spaces, tabs, newlines) to a
// single space so visually-equivalent names compare equal.
// "Taruṇa Govinda Dāsa" and "Taruna  Govinda\tDasa" both normalize to
// "taruna govinda dasa".
export function normalizeName(name: string): string {
  return stripDiacritics(name.trim().replace(/\s+/g, " ")).toLowerCase();
}

// Canonical category form: trim, collapse ALL whitespace runs (spaces,
// tabs, newlines) to a single space, and force Title Case (first letter of
// each word — including hyphenated compounds — uppercase, the rest
// lowercase). The result doubles as the display value and the global
// uniqueness key, so "holy  name", "Holy Name" and "HOLY NAME" are all the
// same category. Unlike channel names, diacritics are preserved as typed
// ("Kršna" stays "Kršna").
export function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[ -])(\S)/g, (_, space: string, char: string) => space + char.toUpperCase());
}

// Lowercases, folds diacritics, and collapses non-alphanumeric runs to single
// dashes (no length limit). The building block for post slugs.
function slugifyText(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Converts a display name into a URL-safe slug by normalizing diacritics and
// collapsing non-alphanumeric runs. Examples:
//   "Tomáš Hromník (Taruna)" → "tomas-hromnik-taruna"
//   "Hello World!" → "hello-world"
export function slugifyName(name: string): string {
  return slugifyText(name).slice(0, 80) || "channel";
}

// Derives a category's URL slug from its canonical name ("Holy Name" →
// "holy-name"). Falls back to "category" when nothing slug-able remains
// (e.g. "!!!"). Distinct names can slugify alike ("Holy-Name" vs "Holy
// Name") — the service disambiguates with a numeric suffix.
export function deriveCategorySlug(name: string): string {
  return slugifyText(name).slice(0, CATEGORY_NAME_MAX_LENGTH) || "category";
}

// Builds a URL slug from post content. Folds diacritics (so "když" → "kdyz",
// "Śrī" → "sri"), lowercases, and joins words with dashes. When the content is
// longer than `maxLength` it prefers to END ON A SENTENCE BOUNDARY:
// it accumulates whole sentences (split on . ! ? and line breaks) while they
// fit, so the slug reads as complete thoughts instead of cutting mid-sentence
// or trailing off into the start of the next one. Falls back to a word-boundary
// cut when even the first sentence exceeds the limit, and to a hard cut for a
// single word longer than the limit.
export function derivePostSlug(content: string | null | undefined, maxLength: number = POST_SLUG_MAX_LENGTH): string | undefined {
  if (!content) return undefined;

  const full = slugifyText(content);
  if (!full) return undefined;
  if (full.length <= maxLength) return full;

  // Accumulate whole sentences while they still fit within the limit.
  const sentences = content
    .split(/[.!?\n\r]+/)
    .map((sentence) => slugifyText(sentence))
    .filter(Boolean);

  let accumulated = "";
  for (const sentence of sentences) {
    const candidate = accumulated ? `${accumulated}-${sentence}` : sentence;
    if (candidate.length <= maxLength) {
      accumulated = candidate;
    } else {
      break;
    }
  }
  // Prefer the sentence boundary, but only when it fills a reasonable share of
  // the limit. If accumulation stopped far short — e.g. a tiny first sentence
  // ("Hi.") followed by one long sentence — fall through to the word-boundary
  // cut below so the slug stays useful instead of collapsing to a few chars.
  if (accumulated.length >= maxLength / 2) return accumulated;

  // First sentence alone exceeds the limit (or accumulation was too short): cut
  // the full text back to the last whole word, or hard-cut a single over-long
  // word.
  const truncated = full.slice(0, maxLength);
  const lastDash = truncated.lastIndexOf("-");
  return (lastDash > 0 ? truncated.slice(0, lastDash) : truncated) || undefined;
}

// Builds a blog article's URL slug from its title. Same sentence-aware
// derivation as timeline posts, but capped at BLOG_SLUG_MAX_LENGTH (== title
// length) instead of POST_SLUG_MAX_LENGTH. Also normalizes user-supplied
// slugs: the service runs custom slugs through here so free-typed input
// ("My Custom Slug!") stores URL-safe ("my-custom-slug").
export function deriveBlogSlug(title: string | null | undefined): string | undefined {
  return derivePostSlug(title, BLOG_SLUG_MAX_LENGTH);
}

// Returns content with all http(s) URLs removed (tokens from autolink).
// Used so a bare URL never becomes a `https-www-...` slug.
export function stripUrlsFromContent(content: string): string {
  const tokens = tokenizeUrls(content);
  return tokens
    .filter((t) => t.type === "text")
    .map((t) => t.value)
    .join("");
}

// True when content contains at least one URL and nothing else after
// stripping URLs (trimmed). e.g. "https://youtu.be/xxx" or
// "  https://example.com \n https://other.com  " -> true; mixed text -> false.
export function isUrlOnlyContent(content: string | null | undefined): boolean {
  if (!content) return false;
  const tokens = tokenizeUrls(content);
  const hasUrl = tokens.some((t) => t.type === "url");
  if (!hasUrl) return false;
  const stripped = stripUrlsFromContent(content);
  return stripped.trim() === "";
}

// Derive a post slug preferring human text. Rules:
// - For URL-only posts with a supplied linkTitle, slug from linkTitle.
// - Otherwise slug from content stripped of URLs.
// - Fallback to linkTitle when stripped content yields nothing.
// Avoids `https-www-youtube-com-...` slugs while preserving meaningful text
// for mixed posts (`Hello https://... world` -> `hello-world`).
export function derivePostSlugFromContent(
  content: string | null | undefined,
  linkTitle?: string | null | undefined,
  maxLength: number = POST_SLUG_MAX_LENGTH,
): string | undefined {
  const trimmedTitle = linkTitle?.trim() || undefined;
  const isUrlOnly = isUrlOnlyContent(content ?? undefined);

  if (isUrlOnly && trimmedTitle) {
    const fromTitle = derivePostSlug(trimmedTitle, maxLength);
    if (fromTitle) return fromTitle;
  }

  const stripped = content ? stripUrlsFromContent(content) : "";
  const fromStripped = derivePostSlug(stripped, maxLength);
  if (fromStripped) return fromStripped;

  if (trimmedTitle) {
    const fromTitle = derivePostSlug(trimmedTitle, maxLength);
    if (fromTitle) return fromTitle;
  }

  // For URL-only with unreadable title, return undefined (stored as null)
  // rather than a garbage `https-...` slug.
  return undefined;
}

// Checks whether `name` contains all words from the brand name (case-insensitive).
// Used to block registration/rename when someone tries to use the app's own brand.
// The brand name is configurable via SINCERE_BHAKTI_NAME env var (default: "Sincere Bhakti").
// Each word is matched as a substring, so "1sincere bhakti whatever" and "sincerebhakti"
// both trigger the block.
export function isBrandName(name: string, brandName?: string): boolean {
  const words = (brandName ?? "Sincere Bhakti")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return false;
  const lowerName = name.toLowerCase();
  return words.every(word => lowerName.includes(word));
}

// Returns true when the name is a brand variant AND the caller is not the
// SINCERE_BHAKTI_EMAIL owner. The owner is allowed to use the brand name.
export function isBrandNameBlocked(name: string, callerEmail: string | null | undefined): boolean {
  if (!process.env.SINCERE_BHAKTI_EMAIL || callerEmail !== process.env.SINCERE_BHAKTI_EMAIL) {
    return isBrandName(name, process.env.SINCERE_BHAKTI_NAME);
  }
  return false;
}

export function isNameUnchanged(newName: string, currentName: string): boolean {
  return normalizeName(newName) === normalizeName(currentName);
}
