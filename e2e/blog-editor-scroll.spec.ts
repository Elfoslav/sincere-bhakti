import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers";
import en from "../messages/en.json";

for (const width of [1440, 390]) {
  for (const mode of ["create", "edit"] as const) {
    test(`article toolbar stays against the scroll area while ${mode} editing at ${width}px`, async ({ page }) => {
      await mockAuthenticatedApp(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 850 });
      const paragraphs = Array.from({ length: 40 }, (_, index) => `Reflection ${index + 1}: A quiet moment of devotion and remembrance in daily life.`);
      const content = JSON.stringify({ type: "doc", content: paragraphs.map(text => ({ type: "paragraph", content: [{ type: "text", text }] })) });
      const post = { id: "scroll-article", shortId: "scroll12", slug: "scroll-article", title: "A long reflection", content, contentHtml: "<p>A quiet moment of devotion</p>", excerpt: null, coverUrl: null, isPublic: true, language: "en", categories: [], publishedAt: null, createdAt: "2026-10-27T09:00:00Z", channel: { id: "test-channel-1", ownerId: "test-user-1", slug: "test-user", name: "Test User", avatarUrl: null } };
      await page.route("**/api/blog-posts?**", route => route.fulfill({ json: { posts: mode === "edit" ? [post] : [], hasMore: false } }));
      await page.route("**/api/posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
      await page.goto("/blog?q=scroll");
      if (mode === "create") await page.locator(".page-header-action").getByRole("button", { name: en.ContentComposer.newarticle, exact: true }).click();
      else await page.locator(".article-row").getByRole("button", { name: en.BlogPage.editPost, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: mode === "create" ? en.ContentComposer.newarticle : en.BlogPage.editTitle, exact: true });
      const editor = dialog.locator('[contenteditable="true"]');
      await expect(editor).toBeVisible();
      if (mode === "create") await editor.fill(paragraphs.join("\n\n"));
      const toolbar = dialog.getByRole("toolbar", { name: en.BlogPage.formattingToolbar });
      const scroll = dialog.locator(".content-composer-body");
      const checkSticky = async () => {
        await scroll.evaluate(element => { element.scrollTop = 500; });
        await expect.poll(async () => {
          const bar = (await toolbar.boundingBox())!;
          const body = (await scroll.boundingBox())!;
          return Math.abs(bar.y - body.y);
        }).toBeLessThanOrEqual(1);
        await expect(toolbar.getByRole("button", { name: en.BlogPage.formatBold, exact: true })).toBeInViewport();
        await scroll.evaluate(element => { element.scrollTop = 700; });
        const bar = (await toolbar.boundingBox())!;
        const body = (await scroll.boundingBox())!;
        expect(Math.abs(bar.y - body.y)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      };
      await checkSticky();
      if (width > 640) {
        await dialog.getByRole("button", { name: en.ContentComposer.expand }).click();
        await checkSticky();
      }
    });
  }
}
