import { z } from "zod";
import { locales } from "@/i18n/routing";

export const PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_SALT_ROUNDS = 12;

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
    .max(50),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(255),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .max(128),
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

export const createPostSchema = z.object({
  id: z.string().min(1).max(36).optional(),
  content: contentField,
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
    .max(50),
});

export const paginationSchema = z.object({
  scope: z.enum(["public", "private"]).optional(),
  cursor: z.string().min(1).optional(),
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
});

export const batchUploadUrlSchema = z.object({
  postId: z.string().min(1).max(36),
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

export const compressSchema = z.object({
  key: z.string().min(1).max(500),
});
