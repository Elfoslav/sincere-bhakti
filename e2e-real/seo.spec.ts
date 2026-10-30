import { expect, test } from "./fixtures";
import sharp from "sharp";
import { POST_OG_IMAGE, TEXT_OG_IMAGE } from "../src/lib/seo";
import { getPostUrl } from "../src/lib/post-url";
import {
  cleanupUsersByEmail,
  createPostForChannel,
  createUserWithChannel,
  uniqueE2EEmail,
} from "./helpers";

test("public post and author channel expose canonical SEO metadata", async ({ page, request }) => {
  const email = uniqueE2EEmail("seo-author");
  const name = `E2E SEO Channel ${Date.now()}`;
  const { channel, slug } = await createUserWithChannel({ name, email });
  const content = `SEO metadata post ${Date.now()} with channel name in the title`;
  const post = await createPostForChannel({ channelId: channel.id, content, language: "en" });

  try {
    await page.goto(`/posts/${post.id}`);
    await expect(page).toHaveTitle(new RegExp(`${name}: ${content} \\| Sincere Bhakti`));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", content);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", `${name}: ${content}`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`/posts/${post.shortId}/opengraph-image$`));
    // Post OG images are served as JPEG (POST_OG_IMAGE) — photos re-encoded as PNG blow past WhatsApp's size limit.
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute("content", "image/jpeg");
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${getPostUrl(post.shortId, post.slug)}$`));
    const postJsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent() ?? "[]");
    expect(postJsonLd).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "@type": "SocialMediaPosting",
        headline: `${name}: ${content}`,
        image: [expect.stringMatching(new RegExp(`/posts/${post.shortId}/opengraph-image$`))],
      }),
      expect.objectContaining({ "@type": "BreadcrumbList" }),
    ]));

    const postImage = await request.get(`/posts/${post.shortId}/opengraph-image`);
    await expect(postImage).toBeOK();
    const postBuffer = await postImage.body();
    expect(await sharp(postBuffer).metadata()).toMatchObject({ format: "jpeg", width: POST_OG_IMAGE.width, height: POST_OG_IMAGE.height });
    expect(postBuffer.length).toBeLessThan(600 * 1024);

    await page.goto(`/channels/${slug}`);
    await expect(page).toHaveTitle(new RegExp(`${name} \\| Sincere Bhakti`));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`/channels/${slug}/opengraph-image$`));
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute("content", "image/png");
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/channels/${slug}$`));
    const channelJsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent() ?? "[]");
    expect(channelJsonLd).toEqual(expect.arrayContaining([
      expect.objectContaining({
        "@type": "ProfilePage",
        image: expect.stringMatching(new RegExp(`/channels/${slug}/opengraph-image$`)),
        mainEntity: expect.objectContaining({
          "@type": "Organization",
          name,
          image: expect.stringMatching(new RegExp(`/channels/${slug}/opengraph-image$`)),
        }),
      }),
    ]));
    const channelOgImage = await request.get(`/channels/${slug}/opengraph-image`);
    await expect(channelOgImage).toBeOK();
    expect(channelOgImage.headers()["content-type"]).toContain("image/png");
    const channelBuffer = await channelOgImage.body();
    expect(await sharp(channelBuffer).metadata()).toMatchObject({ format: "png", width: TEXT_OG_IMAGE.width, height: TEXT_OG_IMAGE.height });
    expect(channelBuffer.length).toBeLessThan(600 * 1024);

    const sitemap = await request.get("/sitemap.xml");
    await expect(sitemap).toBeOK();
    const sitemapXml = await sitemap.text();
    // Production serves a revalidated sitemap, so newly seeded rows need not
    // appear until its cache expires. Dynamic visibility/URL mapping is also
    // covered by the sitemap unit tests.
    expect(sitemapXml).toContain("<urlset");
    expect(sitemapXml).toMatch(/<loc>https?:\/\/[^<]+\/posts<\/loc>/);
    expect(sitemapXml).toMatch(/<loc>https?:\/\/[^<]+\/channels<\/loc>/);
    expect(sitemapXml).not.toContain(`/posts/${post.id}`);
    expect(sitemapXml).not.toContain("/profile/");
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
