import { z } from "zod";
import { locales } from "@/i18n/routing";
import { CHANNEL_MEMBER_ACTIONS, CHANNEL_MEMBER_ROLES } from "@/lib/channel-roles";

export const PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_SALT_ROUNDS = 12;
export const NAME_MAX_LENGTH = 50;
export const MAX_RENAME_COUNT = 3;
// Max length of a post's URL slug (derived from its content). Kept in the
// SEO-friendly ~50-60 range; the permanent shortId is the real identifier, so
// the slug is cosmetic. Must stay in sync with the slug backfill in
// prisma/migrations/20260728120000_add_post_shortid_slug.
export const POST_SLUG_MAX_LENGTH = 60;

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
  name: z
    .string()
    .trim()
    .min(1)
    .max(NAME_MAX_LENGTH),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(255),
  password: z
    .string()
    .trim()
    .min(PASSWORD_MIN_LENGTH)
    .max(128),
  terms: z
    .literal(true, { message: "terms_required" }),
});

// Intrinsic pixel dimensions are optional metadata detected client-side. They
// are used to pick a horizontal image for Open Graph previews and can drive
// layout sizing. Capped to a sane maximum to reject bogus values.
const MAX_MEDIA_DIMENSION = 100_000;

export const mediaItemSchema = z.object({
  url: z.string().url().max(2000).refine(isSafeHttpUrl),
  type: z.enum(["image", "video", "youtube", "file"]),
  width: z.number().int().positive().max(MAX_MEDIA_DIMENSION).optional(),
  height: z.number().int().positive().max(MAX_MEDIA_DIMENSION).optional(),
});

const contentField = z.string().trim().max(5000).optional();
const mediaField = z.array(mediaItemSchema).max(10).optional();

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createPostSchema = z.object({
  id: z.string().regex(uuidRegex).optional(),
  content: contentField,
  channelId: z.string().optional(),
  media: mediaField.default([]),
  isPublic: z.boolean().default(true),
  language: z.enum(locales).default("en"),
}).refine(
  (data) => data.content || data.media.length > 0,
);

export const updatePostSchema = z.object({
  content: z.string().trim().max(5000).nullish(),
  media: mediaField,
  isPublic: z.boolean().optional(),
  language: z.enum(locales).optional(),
}).refine(
  (data) => {
    const clearContent = data.content === null || data.content === "";
    const clearMedia = Array.isArray(data.media) && data.media.length === 0;
    return !(clearContent && clearMedia);
  },
);

export const updateNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(NAME_MAX_LENGTH),
});

export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(NAME_MAX_LENGTH),
  language: z.string().min(1).max(10).optional(),
});

export const createChannelTranslationSchema = createChannelSchema.extend({
  language: z.string().min(1).max(10),
});

export const addChannelMemberSchema = z.object({
  action: z.enum(CHANNEL_MEMBER_ACTIONS),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(255),
  role: z.enum(CHANNEL_MEMBER_ROLES),
});

export const paginationSchema = z.object({
  scope: z.enum(["public", "private"]).optional(),
  cursor: z.string().min(1).trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  channelId: z.string().min(1).optional(),
  language: z.enum(locales).optional(),
});

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z
    .string()
    .min(1)
    .max(255)
    .refine(isAllowedUploadContentType),
  postId: z.string().min(1).max(36),
  channelId: z.string().min(1).optional(),
  contentLength: z.number().int().positive().max(MAX_VIDEO_SIZE_BYTES).optional(),
});

export const batchUploadUrlSchema = z.object({
  postId: z.string().min(1).max(36),
  channelId: z.string().min(1).optional(),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(255).refine(isAllowedUploadContentType),
        size: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(10),
});

export const updateActiveIdentitySchema = z.object({
  channelId: z.string().min(1),
});

export const compressSchema = z.object({
  key: z.string().min(1).max(500),
});

// Folds diacritics to base ASCII via Unicode NFD decomposition, then drops the
// combining marks. Handles Czech/Slovak (ž→z, ě→e, ý→y, …) and IAST/Sanskrit
// (ā→a, ṛ→r, ś→s, ṇ→n, ḥ→h, …). Shared by name normalization and
// slug derivation so both fold diacritics identically.
export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Strips diacritics and lowercases for fuzzy-unique name comparison.
// "Taruṇa Govinda Dāsa" and "Taruna Govinda Dasa" both normalize to "taruna govinda dasa".
export function normalizeName(name: string): string {
  return stripDiacritics(name.trim()).toLowerCase();
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
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "channel";
}

// Builds a URL slug from post content. Folds diacritics (so "když" → "kdyz",
// "Śrī" → "sri"), lowercases, and joins words with dashes. When the content is
// longer than POST_SLUG_MAX_LENGTH it prefers to END ON A SENTENCE BOUNDARY:
// it accumulates whole sentences (split on . ! ? and line breaks) while they
// fit, so the slug reads as complete thoughts instead of cutting mid-sentence
// or trailing off into the start of the next one. Falls back to a word-boundary
// cut when even the first sentence exceeds the limit, and to a hard cut for a
// single word longer than the limit.
export function derivePostSlug(content: string | null | undefined): string | undefined {
  if (!content) return undefined;

  const full = slugifyText(content);
  if (!full) return undefined;
  if (full.length <= POST_SLUG_MAX_LENGTH) return full;

  // Accumulate whole sentences while they still fit within the limit.
  const sentences = content
    .split(/[.!?\n\r]+/)
    .map((sentence) => slugifyText(sentence))
    .filter(Boolean);

  let accumulated = "";
  for (const sentence of sentences) {
    const candidate = accumulated ? `${accumulated}-${sentence}` : sentence;
    if (candidate.length <= POST_SLUG_MAX_LENGTH) {
      accumulated = candidate;
    } else {
      break;
    }
  }
  if (accumulated) return accumulated;

  // First sentence alone exceeds the limit: cut back to the last whole word, or
  // hard-cut a single over-long word.
  const truncated = full.slice(0, POST_SLUG_MAX_LENGTH);
  const lastDash = truncated.lastIndexOf("-");
  return (lastDash > 0 ? truncated.slice(0, lastDash) : truncated) || undefined;
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
