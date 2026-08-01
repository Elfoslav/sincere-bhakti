import { headers } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { getNoIndexMetadata } from "@/lib/seo";
import DesignSystemHarness from "./design-system-harness";

export const metadata: Metadata = getNoIndexMetadata("Design system");

export default async function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) {
    notFound();
  }

  return <DesignSystemHarness />;
}
