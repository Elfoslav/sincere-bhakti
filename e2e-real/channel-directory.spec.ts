import { expect, test } from "@playwright/test";
import { cleanupUsersByEmail, createUserWithPersonalChannel, prisma, uniqueE2EEmail } from "./helpers";

test("channel directory previews and activity never expose private or scheduled content", async ({ request }) => {
  const email = uniqueE2EEmail("directory");
  const name = `Directory Audit ${crypto.randomUUID().slice(0, 8)}`;
  const { channel } = await createUserWithPersonalChannel({ name, email });
  try {
    const publicDate = new Date("2026-01-10T12:00:00Z");
    await prisma.post.createMany({ data: [
      { shortId: crypto.randomUUID().slice(0, 8), channelId: channel.id, content: "Visible reflection", isPublic: true, language: "en", createdAt: publicDate },
      { shortId: crypto.randomUUID().slice(0, 8), channelId: channel.id, content: "Private secret reflection", isPublic: false, language: "en" },
      { shortId: crypto.randomUUID().slice(0, 8), channelId: channel.id, content: "Scheduled secret reflection", isPublic: true, language: "en", publishedAt: new Date("2999-01-01") },
      { shortId: crypto.randomUUID().slice(0, 8), channelId: channel.id, content: "Other language reflection", isPublic: true, language: "cs" },
    ] });
    for (const sort of ["newest", "active"]) {
      const response = await request.get(`/api/channels?${new URLSearchParams({ language: "en", q: name, sort })}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({ latestPostPreview: "Visible reflection", postCount: 1, latestPostAt: publicDate.toISOString() });
      expect(JSON.stringify(body)).not.toMatch(/secret reflection|Other language reflection/);
    }
    const hidden = await prisma.blogPost.create({ data: { shortId: crypto.randomUUID().slice(0, 8), channelId: channel.id, title: "Private linked title", content: "Private article", isPublic: false } });
    await prisma.post.create({ data: { shortId: crypto.randomUUID().slice(0, 8), channelId: channel.id, isPublic: true, blogPostId: hidden.id } });
    const response = await request.get(`/api/channels?${new URLSearchParams({ language: "en", q: name })}`);
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain("Private linked title");
  } finally {
    await cleanupUsersByEmail([email]);
  }
});
