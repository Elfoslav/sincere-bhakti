import { expect, test } from "@playwright/test";
import {
  cleanupUsersByEmail,
  createPostForChannel,
  createUserWithPersonalChannel,
  uniqueE2EEmail,
} from "./helpers";

test("public post, channel, profile, and sitemap expose SEO metadata", async ({ page, request }) => {
  const email = uniqueE2EEmail("seo-author");
  const name = `E2E SEO Channel ${Date.now()}`;
  const { user, channel } = await createUserWithPersonalChannel({ name, email });
  const content = `SEO metadata post ${Date.now()} with channel name in the title`;
  const post = await createPostForChannel({ channelId: channel.id, content, language: "en" });

  try {
    await page.goto(`/posts/${post.id}`);
    await expect(page).toHaveTitle(new RegExp(`${name}: ${content} \\| Sincere Bhakti`));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", content);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", `${name}: ${content}`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`/posts/${post.id}/opengraph-image$`));
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute("content", "image/png");
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/posts/${post.id}$`));
    const postJsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent() ?? "[]");
    expect(postJsonLd).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "@type": "SocialMediaPosting",
        headline: `${name}: ${content}`,
        image: [expect.stringMatching(new RegExp(`/posts/${post.id}/opengraph-image$`))],
      }),
      expect.objectContaining({ "@type": "BreadcrumbList" }),
    ]));

    await page.goto(`/channels/${channel.slug}`);
    await expect(page).toHaveTitle(new RegExp(`${name} \\| Sincere Bhakti`));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`/channels/${channel.slug}/opengraph-image$`));
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute("content", "image/png");
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/channels/${channel.slug}$`));
    const channelJsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent() ?? "[]");
    expect(channelJsonLd).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "@type": "ProfilePage",
        image: expect.stringMatching(new RegExp(`/channels/${channel.slug}/opengraph-image$`)),
        mainEntity: expect.objectContaining({
          "@type": "Organization",
          name,
          image: expect.stringMatching(new RegExp(`/channels/${channel.slug}/opengraph-image$`)),
        }),
      }),
    ]));
    const channelOgImage = await request.get(`/channels/${channel.slug}/opengraph-image`);
    await expect(channelOgImage).toBeOK();
    expect(channelOgImage.headers()["content-type"]).toContain("image/png");

    await page.goto(`/profile/${user.id}`);
    await expect(page).toHaveTitle(new RegExp(`${name} \\| Sincere Bhakti`));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", `${name} on Sincere Bhakti.`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`/profile/${user.id}/opengraph-image$`));
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute("content", "image/png");
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    const profileJsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent() ?? "[]");
    expect(profileJsonLd).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "@type": "ProfilePage",
        image: expect.stringMatching(new RegExp(`/profile/${user.id}/opengraph-image$`)),
        mainEntity: expect.objectContaining({
          "@type": "Person",
          name,
          image: expect.stringMatching(new RegExp(`/profile/${user.id}/opengraph-image$`)),
        }),
      }),
    ]));
    const profileOgImage = await request.get(`/profile/${user.id}/opengraph-image`);
    await expect(profileOgImage).toBeOK();
    expect(profileOgImage.headers()["content-type"]).toContain("image/png");

    const sitemap = await request.get("/sitemap.xml");
    await expect(sitemap).toBeOK();
    const sitemapXml = await sitemap.text();
    expect(sitemapXml).toContain(`/posts/${post.id}`);
    expect(sitemapXml).toContain(`/channels/${channel.slug}`);
    expect(sitemapXml).toContain(`/profile/${user.id}`);
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
