import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers";
import en from "../messages/en.json";

for (const width of [1440, 390, 320]) {
  for (const paragraphs of [1, 30]) {
    test(`editing ${paragraphs} article paragraphs reveals save errors and preserves their position during retry at ${width}px`, async ({ page }) => {
      await mockAuthenticatedApp(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 800 });
      const content = JSON.stringify({ type: "doc", content: Array.from({ length: paragraphs }, (_, index) => ({ type: "paragraph", content: [{ type: "text", text: `Reflection ${index + 1}: A moment of devotion to keep while editing this article.` }] })) });
      const post = { id: "steady-article", shortId: "steady12", slug: "steady-article", title: "Steady article", content, contentHtml: "<p>A moment of devotion</p>", excerpt: "A summary", coverUrl: null, isPublic: true, language: "en", categories: [], publishedAt: null, createdAt: "2026-10-27T09:00:00Z", channel: { id: "test-channel-1", ownerId: "test-user-1", slug: "test-user", name: "Test User", avatarUrl: null } };
      await page.route("**/api/blog-posts?**", route => route.fulfill({ json: { posts: new URL(route.request().url()).searchParams.get("q") === "steady" ? [post] : [], hasMore: false } }));
      await page.route("**/api/posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
      let release: () => void = () => {};
      let responseGate = new Promise<void>(resolve => { release = resolve; });
      await page.route("**/api/blog-posts/steady-article", async route => {
        if (route.request().method() === "PATCH") {
          await responseGate;
          await route.fulfill({ status: 429, json: { error: "too_many_requests" } });
        } else await route.fulfill({ json: post });
      });
      await page.goto("/blog?q=steady");
      const row = page.locator(".article-row").filter({ has: page.getByRole("heading", { name: post.title, exact: true }) });
      await row.getByRole("button", { name: en.BlogPage.editPost, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: en.BlogPage.editTitle, exact: true });
      await expect(dialog.locator('[contenteditable="true"]')).toBeVisible();
      await dialog.getByPlaceholder(en.BlogPage.titlePlaceholder, { exact: true }).fill("Steady article updated");
      const editor = dialog.locator('[contenteditable="true"]');
      await editor.press("ControlOrMeta+End");
      await page.keyboard.insertText(" An added reflection.");
      const save = dialog.getByRole("button", { name: en.ContentComposer.saveChanges, exact: true });
      await expect(save).toBeEnabled();
      await save.scrollIntoViewIfNeeded();
      const readGeometry = () => dialog.evaluate(element => {
        const body = element.querySelector(".content-composer-body")!;
        const editor = element.querySelector(".tiptap")!;
        return { modalTop: element.getBoundingClientRect().top, modalHeight: element.getBoundingClientRect().height, actionsTop: element.querySelector(".content-form-actions")!.getBoundingClientRect().top, scrollTop: body.scrollTop, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, editorHeight: editor.getBoundingClientRect().height, editorTop: editor.getBoundingClientRect().top };
      });
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      const before = await readGeometry();
      const button = (await save.boundingBox())!;
      await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
      await expect(dialog.getByRole("button", { name: en.ContentComposer.workingShort, exact: true })).toBeDisabled();
      await expect(dialog.locator('[contenteditable="false"]')).toBeVisible();
      const during = await readGeometry();
      expect(during).toEqual(before);
      await dialog.locator(".content-composer-body").evaluate(element => { element.scrollTop = 0; });
      release();
      await expect(save).toBeEnabled();
      await expect(dialog.getByRole("alert")).toHaveText(en.Common.tooManyRequests);
      const alert = dialog.getByRole("alert");
      await expect(alert).toBeInViewport({ ratio: 1 });
      await expect.poll(async () => {
        const error = (await alert.boundingBox())!;
        const footer = (await dialog.locator(".content-form-actions").boundingBox())!;
        return error.y + error.height <= footer.y;
      }).toBe(true);
      const withError = await readGeometry();
      if (process.env.FEED_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.FEED_SCREENSHOTS_DIR}/rate-limit-${width}-${paragraphs}.png` });
      responseGate = new Promise<void>(resolve => { release = resolve; });
      const retry = (await save.boundingBox())!;
      await page.mouse.click(retry.x + retry.width / 2, retry.y + retry.height / 2);
      await expect(dialog.getByRole("button", { name: en.ContentComposer.workingShort, exact: true })).toBeDisabled();
      await expect(dialog.getByRole("alert")).toHaveText(en.Common.tooManyRequests);
      expect(await readGeometry()).toEqual(withError);
      release();
      await expect(save).toBeEnabled();
      await expect(dialog.getByRole("alert")).toHaveText(en.Common.tooManyRequests);
      expect(await readGeometry()).toEqual(withError);
      await expect(dialog.getByPlaceholder(en.BlogPage.titlePlaceholder, { exact: true })).toHaveValue("Steady article updated");
    });
  }
}
