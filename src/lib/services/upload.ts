import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { MAX_IMAGE_DIMENSION, IMAGE_JPEG_QUALITY } from "@/lib/validation";

const REQUIRED_ENV_VARS = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"] as const;

function ensureEnvVars(): void {
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

export interface UploadUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

let s3: S3Client;

function getS3Client(): S3Client {
  if (!s3) {
    ensureEnvVars();
    s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3;
}

export function setS3Client(mock: S3Client) {
  s3 = mock;
}

function objectKey(fileName: string, postId: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `posts/${postId}/${randomUUID()}-${safe}`;
}

export async function createUploadUrl(
  fileName: string,
  contentType: string,
  postId: string,
): Promise<UploadUrlResult> {
  const client = getS3Client();
  const key = objectKey(fileName, postId);
  const bucket = process.env.R2_BUCKET ?? "sincere-bhakti-uploads";

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}

export interface ProcessUploadResult {
  publicUrl: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  key: string;
}

export interface ProcessImageResult {
  buffer: Buffer;
  contentType: string;
  width: number | null;
  height: number | null;
}

export async function processImage(
  buffer: Buffer,
  contentType: string,
): Promise<ProcessImageResult> {
  if (!contentType.startsWith("image/") || contentType === "image/gif") {
    return { buffer, contentType, width: null, height: null };
  }

  let finalBuffer = buffer;
  let finalType = contentType;
  let width: number | null = null;
  let height: number | null = null;

  const meta = await sharp(buffer).metadata();
  const needsResize = (meta.width ?? 0) > MAX_IMAGE_DIMENSION || (meta.height ?? 0) > MAX_IMAGE_DIMENSION;

  if (needsResize) {
    const resized = sharp(buffer).resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

    switch (contentType) {
      case "image/jpeg":
        finalBuffer = await resized.jpeg({ quality: IMAGE_JPEG_QUALITY }).toBuffer();
        finalType = "image/jpeg";
        break;
      case "image/png":
        finalBuffer = await resized.webp({ quality: IMAGE_JPEG_QUALITY }).toBuffer();
        finalType = "image/webp";
        break;
      case "image/webp":
        finalBuffer = await resized.webp({ quality: IMAGE_JPEG_QUALITY }).toBuffer();
        finalType = "image/webp";
        break;
      case "image/avif":
        finalBuffer = await resized.avif({ quality: IMAGE_JPEG_QUALITY - 10 }).toBuffer();
        finalType = "image/avif";
        break;
    }
  } else {
    switch (contentType) {
      case "image/png": {
        const reEncoded = await sharp(buffer).webp({ quality: IMAGE_JPEG_QUALITY }).toBuffer();
        if (reEncoded.length < buffer.length) {
          finalBuffer = reEncoded;
          finalType = "image/webp";
        }
        break;
      }
      case "image/webp": {
        const reEncoded = await sharp(buffer).webp({ quality: IMAGE_JPEG_QUALITY }).toBuffer();
        finalBuffer = reEncoded.length < buffer.length ? reEncoded : buffer;
        break;
      }
      case "image/avif": {
        const reEncoded = await sharp(buffer).avif({ quality: IMAGE_JPEG_QUALITY - 10 }).toBuffer();
        finalBuffer = reEncoded.length < buffer.length ? reEncoded : buffer;
        break;
      }
    }
  }

  const finalMeta = await sharp(finalBuffer).metadata();
  width = finalMeta.width ?? null;
  height = finalMeta.height ?? null;

  return { buffer: finalBuffer, contentType: finalType, width, height };
}

export async function compressR2Object(key: string): Promise<ProcessUploadResult> {
  const client = getS3Client();
  const bucket = process.env.R2_BUCKET ?? "sincere-bhakti-uploads";

  const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const { Body, ContentType } = await client.send(getCmd);
  if (!Body) throw new Error("Empty object");
  const inputType = ContentType ?? "application/octet-stream";

  if (!inputType.startsWith("image/") || inputType === "image/gif") {
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    return { publicUrl, mediaType: contentTypeToMediaType(inputType), width: null, height: null, key };
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  const { buffer: processed, contentType: finalType, width, height } = await processImage(buffer, inputType);

  const putCmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: processed,
    ContentType: finalType,
  });
  await client.send(putCmd);

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { publicUrl, mediaType: contentTypeToMediaType(finalType), width, height, key };
}

export function contentTypeToMediaType(contentType: string): string {
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("image/")) return "image";
  return "file";
}

export function extractKey(url: string, storageDomain: string): string | null {
  try {
    const parsed = new URL(url);
    const allowed = new URL(storageDomain);
    if (parsed.origin !== allowed.origin) return null;
    const path = parsed.pathname;
    const base = allowed.pathname.replace(/\/+$/, "") || "/";
    const prefix = base === "/" ? "/" : base + "/";
    if (!path.startsWith(prefix)) return null;
    const key = path.slice(prefix.length);
    return key || null;
  } catch {
    return null;
  }
}

export async function deleteMediaFiles(urls: string[]): Promise<void> {
  const storageDomain = process.env.R2_PUBLIC_URL;
  const bucket = process.env.R2_BUCKET;
  if (!storageDomain || !bucket) return;

  const keys = urls
    .map((u) => extractKey(u, storageDomain))
    .filter((k): k is string => k !== null);

  if (keys.length === 0) return;

  try {
    const client = getS3Client();
    await Promise.all(
      keys.map((key) =>
        client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
      ),
    );
  } catch {
    // Logged but not thrown — cleanup failure should not break the request.
    console.error("Failed to delete media files from R2:", keys);
  }
}
