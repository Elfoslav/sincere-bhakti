import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

function objectKey(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `posts/${randomUUID()}-${safe}`;
}

export async function createUploadUrl(
  fileName: string,
  contentType: string,
): Promise<UploadUrlResult> {
  const client = getS3Client();
  const key = objectKey(fileName);
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

export function contentTypeToMediaType(contentType: string): string {
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("image/")) return "image";
  return "file";
}

function extractKey(url: string, storageDomain: string): string | null {
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
