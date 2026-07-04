import { z } from "zod";
import { locales } from "@/i18n/routing";

export const PASSWORD_MIN_LENGTH = 8;

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
        url: z.string().url().max(2000),
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
  contentType: z.string().min(1).max(255),
});
