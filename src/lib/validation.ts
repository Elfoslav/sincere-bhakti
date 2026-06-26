import { z } from "zod";

const cuid = z.string().min(1, "ID is required");

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
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .max(5000, "Content must be 5000 characters or less")
    .optional()
    .or(z.literal("")),
  mediaUrl: z
    .string()
    .url("Invalid media URL")
    .max(2000, "Media URL too long")
    .optional()
    .nullable(),
  mediaType: z
    .enum(["image", "video", "youtube"])
    .optional()
    .nullable(),
  isPublic: z.boolean().default(true),
}).refine(
  (data) => data.content || data.mediaUrl,
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
});
