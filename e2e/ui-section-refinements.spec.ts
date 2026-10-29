import { test, expect } from "@playwright/test";
import en from "../messages/en.json";

for (const width of [1440, 390, 320]) {
  test(`homepage keeps its hero and reserves the article section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/blog-posts?**", async route => {
      await pending;
      await route.fulfill({ json: { posts: [], hasMore: false } });
    });
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1, name: en.HomePage.logoAlt })).toBeVisible();
    const loading = page.getByRole("status").filter({ hasText: en.HomePage.loadingArticles });
    await expect(loading).toHaveCount(1);
    await expect(page.locator('.article-feed-list[aria-busy="true"] .article-row')).toHaveCount(3);
    const hero = page.locator(".home-hero");
    await expect(hero.getByRole("link", { name: en.HomePage.ctaPosts })).toBeVisible();
    await expect(hero.getByRole("link", { name: en.HomePage.ctaJoin })).toBeVisible();
    const overlay = await page.locator(".home-hero-media").evaluate(el => getComputedStyle(el, "::after").backgroundImage);
    expect(overlay).toContain("linear-gradient");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    release();
    await expect(loading).toHaveCount(0);
    await expect(page.getByRole("heading", { name: en.HomePage.blogLatestTitle })).toHaveCount(0);
  });
}

test("rich article previews stay compact, retain their links, and empty searches can recover", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const article = { id: "preview-blog", shortId: "prevblog", slug: "practice", title: "A reflection on daily practice", excerpt: null, content: null, contentHtml: '<h2>Daily practice</h2>' + '<p>A long reflection with several paragraphs and teachings.</p>'.repeat(20), coverUrl: null, isPublic: true, publishedAt: null, language: "en", createdAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-20T09:00:00Z", categories: [], channel: { id: "preview-channel", name: "Community", slug: "community", ownerId: "owner", avatarUrl: null } };
  const post = { id: "preview-post", shortId: "prevpost", slug: "reflection", content: "A reflection from the journal.", media: [], categories: [], channel: article.channel, language: "en", isPublic: true, publishedAt: null, createdAt: article.createdAt, blogPost: article, blogPostId: article.id };
  await page.route("**/api/categories?**", route => route.fulfill({ json: { categories: [] } }));
  await page.route("**/api/posts?**", route => route.fulfill({ json: { posts: new URL(route.request().url()).searchParams.get("q") === "missing" ? [] : [post], hasMore: false } }));
  await page.goto("/en/posts?q=practice");
  const preview = page.locator('.post-card-copy a[href*="prevblog"]');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("href", /practice/);
  const excerpt = preview.locator(".rich-text-excerpt");
  const bounds = await excerpt.evaluate(el => ({ height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight) }));
  expect(bounds.height).toBeLessThanOrEqual(bounds.lineHeight * 2 + 1);
  await expect(preview).toContainText(en.PostCard.readArticle);
  await page.getByRole("searchbox").fill("missing");
  await expect(page.getByRole("status")).toContainText("missing");
  await page.locator(".journal-feed").getByRole("button", { name: en.Common.clearSearch }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page).not.toHaveURL(/q=/);
  await expect(preview).toBeVisible();
});

test("mobile navigation identifies the current section and selected language", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/en/posts");
  await page.getByRole("button", { name: en.Navbar.toggleMenu }).click();
  const menu = page.locator("#mobile-navigation");
  const current = menu.getByRole("link", { name: en.Navbar.posts, exact: true });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(current).toHaveCSS("border-left-width", "4px");
  const language = menu.getByRole("button", { name: en.Common.language, exact: true });
  await expect(language).toContainText(en.Common.language);
  await expect(language).toContainText("English");
  await language.click();
  await expect(page.getByRole("menuitemradio", { name: /English/ })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(language).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
