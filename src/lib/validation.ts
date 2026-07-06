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

// Uploads are restricted to the media types the app actually renders.
// This prevents users from stashing arbitrary files (e.g. HTML) in the bucket.
export const ALLOWED_UPLOAD_CONTENT_TYPE_PREFIXES = ["image/", "video/"] as const;

export function isAllowedUploadContentType(contentType: string): boolean {
  return ALLOWED_UPLOAD_CONTENT_TYPE_PREFIXES.some((prefix) =>
    contentType.startsWith(prefix),
  );
}

// Max upload size (bytes), per media type. Enforced client-side before
// requesting a presigned URL (the file goes browser→R2 directly, so this is
// a UX guard, not server-side enforcement). Videos use a single presigned
// PUT; 200 MB is a safe ceiling for that flow — larger files need multipart.
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

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

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .max(5000)
    .optional(),
  media: z
    .array(
      z.object({
        url: z.string().url().max(2000).refine(isSafeHttpUrl),
        type: z.enum(["image", "video", "youtube", "file"]),
      }),
    )
    .max(10)
    .optional()
    .default([]),
  isPublic: z.boolean().default(true),
  language: z.enum(locales).default("en"),
}).refine(
  (data) => data.content || data.media.length > 0,
);

export const updateNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(50),
});

export const paginationSchema = z.object({
  scope: z.literal("public").optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  authorId: z.string().min(1).optional(),
  language: z.enum(locales).optional(),
});

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z
    .string()
    .min(1)
    .max(255)
    .refine(isAllowedUploadContentType),
});
