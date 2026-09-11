import { prisma } from "@/lib/prisma";
import { extractKey } from "@/lib/services/upload";

/**
 * Remove PendingUpload records for freshly-linked media URLs. Called after a
 * post/blog cover is created or updated so the one-hour upload claims don't
 * linger. Shared by the post and blog services (media ownership is proven via
 * these records before linking).
 */
export async function deletePendingUploads(urls: string[]): Promise<void> {
  const storageDomain = process.env.R2_PUBLIC_URL;
  if (!storageDomain) return;
  const keys = urls
    .map((u) => extractKey(u, storageDomain))
    .filter((k): k is string => k !== null);
  if (keys.length > 0) {
    await prisma.pendingUpload.deleteMany({ where: { key: { in: keys } } });
  }
}
