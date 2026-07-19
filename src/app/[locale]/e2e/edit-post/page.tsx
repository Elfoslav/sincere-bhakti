import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import EditPostHarness from "./edit-post-harness";

export default async function EditPostE2EPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) {
    notFound();
  }

  return <EditPostHarness />;
}
