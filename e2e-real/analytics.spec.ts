import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanupUsersByEmail, createUserWithPersonalChannel, prisma, uniqueE2EEmail } from "./helpers";

test("cookie-free analytics atomically deduplicate visits, gate reads, and hide nonpublic posts", async ({ request, baseURL }) => {
  const email = uniqueE2EEmail("analytics");
  const { user } = await createUserWithPersonalChannel({ name: `Analytics ${Date.now()}`, email });
  const channel = await prisma.channel.findFirstOrThrow({ where: { ownerId: user.id } });
  const post = await prisma.blogPost.create({ data: { shortId: randomUUID().slice(0, 8), title: "Analytics fixture", content: "Text", isPublic: true, channelId: channel.id } });
  const url = `/api/analytics?resourceType=blogPost&resourceId=${post.id}`;
  const headers = { origin: baseURL!, "x-forwarded-for": "192.0.2.91", "user-agent": "Analytics integration browser" };
  const visitId = randomUUID();
  const postEvent = (event: "view" | "read", id = visitId, extra = {}) => request.post(url, { headers: { ...headers, ...extra }, data: { event, visitId: id } });
  try {
    expect((await request.post(url, { headers: { ...headers, origin: "https://evil.test" }, data: { event: "view", visitId } })).status()).toBe(403);
    // A read without a preceding view is ignored.
    await postEvent("read");
    let counts = await (await request.get(url)).json();
    expect(counts).toEqual({ views: 0, reads: 0, uniqueVisitors: 0 });
    const responses = await Promise.all(Array.from({ length: 5 }, () => postEvent("view")));
    expect(responses.every((response) => response.ok())).toBe(true);
    // New visit tokens count visits, but concurrent tabs still share one daily unique.
    await Promise.all(Array.from({ length: 4 }, () => postEvent("view", randomUUID())));
    await postEvent("read");
    counts = await (await request.get(url)).json();
    expect(counts).toEqual({ views: 5, reads: 0, uniqueVisitors: 1 });
    // Age just this test visit receipt to test the server-side read gate without sleeping.
    // Match the view hash using the same env-configured secret as the test server.
    const { hashAnalyticsKey } = await import("../src/lib/analytics-identity");
    const key = hashAnalyticsKey(["visit", "blogPost", post.id, visitId])!;
    await prisma.analyticsReceipt.update({ where: { key }, data: { createdAt: new Date(Date.now() - 31_000) } });
    await Promise.all(Array.from({ length: 4 }, () => postEvent("read")));
    expect(await (await request.get(url)).json()).toEqual({ views: 5, reads: 1, uniqueVisitors: 1 });
    await postEvent("view", randomUUID(), { dnt: "1" });
    await postEvent("view", randomUUID(), { "sec-gpc": "1" });
    expect(await (await request.get(url)).json()).toEqual({ views: 5, reads: 1, uniqueVisitors: 1 });
    await prisma.blogPost.update({ where: { id: post.id }, data: { isPublic: false } });
    expect((await request.get(url)).status()).toBe(404);
    expect((await postEvent("view", randomUUID())).status()).toBe(404);
    await prisma.blogPost.update({ where: { id: post.id }, data: { isPublic: true, publishedAt: new Date(Date.now() + 86400000) } });
    expect((await request.get(url)).status()).toBe(404);
    expect((await postEvent("view", randomUUID())).status()).toBe(404);
  } finally {
    await prisma.analyticsDaily.deleteMany({ where: { resourceType: "blogPost", resourceId: post.id } });
    await cleanupUsersByEmail([email]);
  }
});
