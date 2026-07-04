import { z } from "zod";
import { locales } from "@/i18n/routing";

export const PASSWORD_MIN_LENGTH = 8;

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(255, "Email too long"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(128, "Password too long"),
});

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .max(5000, "Content must be 5000 characters or less")
    .optional(),
  media: z
    .array(
      z.object({
        url: z.string().url("Invalid media URL").max(2000),
        type: z.enum(["image", "video", "youtube", "file"]),
      }),
    )
    .max(10, "Maximum 10 media items per post")
    .optional()
    .default([]),
  isPublic: z.boolean().default(true),
  language: z.enum(locales).default("en"),
}).refine(
  (data) => data.content || data.media.length > 0,
  { message: "Content or media is required" },
);

export const updateNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
});

export const paginationSchema = z.object({
  scope: z.literal("public").optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  authorId: z.string().min(1).optional(),
  language: z.enum(locales).optional(),
});

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1, "fileName is required").max(255),
  contentType: z.string().min(1, "contentType is required").max(255),
});
