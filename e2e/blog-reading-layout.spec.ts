import { test, expect } from "@playwright/test";
import { getBlogUrl } from "../src/lib/blog-url";
import { FEED_DEFAULT_LIMIT } from "../src/lib/validation";
import type { BlogPost } from "../src/types/blog";
import en from "../messages/en.json";

test.setTimeout(60_000);

for (const width of [1440, 1024, 390, 320]) {
  test(`article list has a clear lead story and accessible filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/en/design-preview?palette=saffron&presentation=1");
    const lead = page.locator('.article-row[data-featured="true"]');
    await expect(lead).toHaveCount(1);
    await expect(lead.getByRole("heading", { level: 2 })).toHaveText(en.DesignPreview.article3);
    const cover = (await lead.locator(".article-row-media").boundingBox())!;
    const copy = (await lead.locator(".article-row-copy").boundingBox())!;
    if (width > 640) expect(cover.x + cover.width).toBeLessThan(copy.x);
    else expect(cover.y + cover.height).toBeLessThanOrEqual(copy.y);
    await expect(lead.locator(".article-row-categories")).toContainText(en.DesignPreview.categorypractice);
    await expect(lead.locator(".article-row-author")).toContainText("Sincere Bhakti");
    if (process.env.BLOG_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.BLOG_SCREENSHOTS_DIR}/blog-list-${width}.png`, fullPage: true });
    await page.getByRole("searchbox").fill("remembrance");
    await expect(page.locator(".article-row")).toHaveCount(1);
    await expect(page.locator('.article-row[data-featured="true"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`real article recommendations preserve channel scope and fit the reading page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const response = await page.request.get(`/api/blog-posts?scope=public&language=en&limit=${FEED_DEFAULT_LIMIT}`);
    expect(response.ok()).toBe(true);
    const data = await response.json() as { posts: BlogPost[] };
    // This read-only check uses the project's existing public articles.
    test.skip(data.posts.length < 2, "At least two public articles are needed for recommendation navigation.");
    const post = data.posts[0];
    await page.goto(getBlogUrl(post.shortId, post.slug));
    await expect(page.getByRole("heading", { level: 1, name: post.title, exact: true })).toBeVisible();
    const article = page.locator(".blog-reading-article");
    const sidebar = page.getByRole("complementary", { name: en.BlogPage.moreArticles });
    await expect(sidebar).toBeVisible();
    const main = (await article.boundingBox())!;
    const aside = (await sidebar.boundingBox())!;
    if (width >= 1100) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width);
    else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height);
    const links = sidebar.locator(".article-recommendation-link");
    expect(await links.count()).toBeGreaterThan(0);
    const hrefs = await links.evaluateAll(elements => elements.map(el => el.getAttribute("href")));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).not.toContain(getBlogUrl(post.shortId, post.slug));
    const same = sidebar.getByRole("region", { name: en.BlogPage.moreFromChannel.replace("{name}", post.channel.name) });
    if (await same.count()) for (const name of await same.locator("p.article-recommendation-meta").allTextContents()) expect(name).toBe(post.channel.name);
    const others = sidebar.getByRole("region", { name: en.BlogPage.otherChannels });
    if (await others.count()) for (const name of await others.locator("p.article-recommendation-meta").allTextContents()) expect(name).not.toBe(post.channel.name);
    const body = article.locator(".blog-article-body");
    if (await body.count()) expect((await body.boundingBox())!.width).toBeLessThanOrEqual(672);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.BLOG_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.BLOG_SCREENSHOTS_DIR}/blog-reader-${width}.png` });
    const nextTitle = (await links.first().getByRole("heading").textContent())!;
    await links.first().click();
    await expect(page.getByRole("heading", { level: 1, name: nextTitle, exact: true })).toBeVisible({ timeout: 15_000 });
  });
}
