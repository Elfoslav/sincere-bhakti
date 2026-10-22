import { hashAnalyticsKey } from "@/lib/analytics-identity";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isBlogPubliclyVisible } from "@/lib/blog";
import { NotFoundError } from "@/lib/services/errors";
import { ANALYTICS_CLEANUP_BATCH, ANALYTICS_EMPTY_COUNTS, ANALYTICS_READ_TIME_MS, ANALYTICS_RECEIPT_TTL_MS } from "@/lib/analytics";
import type { analyticsEventSchema, analyticsResourceSchema } from "@/lib/validation";
import type { AnalyticsCounts } from "@/types/analytics";

type Resource = z.infer<typeof analyticsResourceSchema>;

/** New resources must resolve public visibility here before exposing/collecting anything. */
async function requirePublicResource(resource: Resource) {
  switch (resource.resourceType) {
    case "blogPost": {
      const post = await prisma.blogPost.findUnique({
        where: { id: resource.resourceId },
        select: { isPublic: true, publishedAt: true },
      });
      if (!post || !isBlogPubliclyVisible(post)) throw new NotFoundError();
      return;
    }
  }
}

export async function getAnalyticsCounts(resource: Resource): Promise<AnalyticsCounts> {
  await requirePublicResource(resource);
  const rows = await prisma.analyticsDaily.groupBy({
    by: ["metric"],
    where: { resourceType: resource.resourceType, resourceId: resource.resourceId, metric: { in: ["views", "reads", "uniqueVisitors"] } },
    _sum: { count: true },
    take: 3, orderBy: { metric: "asc" },
  });
  const counts = { ...ANALYTICS_EMPTY_COUNTS };
  for (const row of rows) {
    if (row.metric in counts) counts[row.metric as keyof AnalyticsCounts] = row._sum.count ?? 0;
  }
  return counts;
}

/** Cookie-free daily estimates; identities cannot be joined across days/resources. */
export async function recordAnalyticsEvent(
  data: z.infer<typeof analyticsEventSchema>,
  headers: Headers,
  ip: string,
): Promise<void> {
  await requirePublicResource(data);
  const ua = headers.get("user-agent") ?? "";
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1" || /bot|crawler|spider|preview|headless/i.test(ua)) return;
  // Misconfiguration must never silently use a predictable hashing key.
  const viewKey = hashAnalyticsKey(["visit", data.resourceType, data.resourceId, data.visitId]);
  if (!viewKey) return;
  const now = new Date();
  const day = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const target = [data.resourceType, data.resourceId];
  const expiresAt = new Date(now.getTime() + ANALYTICS_RECEIPT_TTL_MS);

  await prisma.$transaction(async (tx) => {
    // Recheck visibility inside the write transaction.
    const visible = await tx.blogPost.count({ where: {
      id: data.resourceId, isPublic: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    } });
    if (!visible) throw new NotFoundError();
    let accepted: number;
    if (data.event === "view") {
      const result = await tx.analyticsReceipt.createMany({
        data: [{ key: viewKey, createdAt: now, expiresAt }], skipDuplicates: true,
      });
      accepted = result.count;
    } else {
      // Reads require a real preceding visit and a server-observed minimum duration.
      const result = await tx.analyticsReceipt.updateMany({
        where: { key: viewKey, readAt: null, expiresAt: { gt: now }, createdAt: { lte: new Date(now.getTime() - ANALYTICS_READ_TIME_MS) } },
        data: { readAt: now },
      });
      accepted = result.count;
    }
    if (!accepted) return;
    const increment = async (metric: string) => {
      const key = { resourceType: data.resourceType, resourceId: data.resourceId, day, metric };
      await tx.analyticsDaily.upsert({ where: { resourceType_resourceId_day_metric: key }, create: { ...key, count: 1 }, update: { count: { increment: 1 } } });
    };
    await increment(data.event === "view" ? "views" : "reads");
    if (data.event === "view" && ip !== "unknown") {
      const key = hashAnalyticsKey(["unique", ...target, day.toISOString(), ip, ua.slice(0, 512)])!;
      const unique = await tx.analyticsReceipt.createMany({ data: [{ key, createdAt: now, expiresAt }], skipDuplicates: true });
      if (unique.count) await increment("uniqueVisitors");
    }
  });
  await cleanupExpiredAnalyticsReceipts(now);
}

/** Bounded cleanup shared by ingestion and the operator maintenance script. */
export async function cleanupExpiredAnalyticsReceipts(now = new Date()): Promise<number> {
  const expired = await prisma.analyticsReceipt.findMany({ where: { expiresAt: { lt: now } }, select: { key: true }, take: ANALYTICS_CLEANUP_BATCH });
  if (!expired.length) return 0;
  const result = await prisma.analyticsReceipt.deleteMany({ where: { key: { in: expired.map((row) => row.key) } } });
  return result.count;
}
