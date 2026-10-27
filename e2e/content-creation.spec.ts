import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers";
import en from "../messages/en.json";

test.setTimeout(60_000);

const surfaces = [
  { path: "/posts", label: en.ContentComposer.newpost, placeholder: en.PostsPage.composePlaceholder, endpoint: "/api/posts" },
  { path: "/blog", label: en.ContentComposer.newarticle, placeholder: en.BlogPage.titlePlaceholder, endpoint: "/api/blog-posts" },
  { path: "/gallery", label: en.ContentComposer.newalbum, placeholder: en.Gallery.titlePlaceholder, endpoint: "/api/albums" },
];

for (const surface of surfaces) {
  for (const width of [1440, 390]) {
    test(`${surface.path} uses the same protected composer at ${width}px`, async ({ page }) => {
      await mockAuthenticatedApp(page);
      await page.route(`**${surface.endpoint}?**`, route => route.fulfill({ json: { posts: [], hasMore: false } }));
      await page.route("https://www.youtube.com/**", route => route.fulfill({ body: "" }));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(surface.path);
      const trigger = page.locator(".page-header-action").getByRole("button", { name: surface.label, exact: true });
      await expect(trigger).toBeVisible();
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: surface.label, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".content-publishing-context")).toContainText("Test User");
      const input = dialog.getByPlaceholder(surface.placeholder, { exact: true });
      await expect(input).toBeFocused();
      await input.fill("A reflection to preserve");
      const cancel = await dialog.getByRole("button", { name: en.Common.cancel, exact: true }).boundingBox();
      const submit = await dialog.locator('.content-submit-actions button[type="submit"]').boundingBox();
      expect(submit!.x).toBeGreaterThan(cancel!.x + cancel!.width);
      expect(Math.abs(submit!.y - cancel!.y)).toBeLessThan(2);
      await expect(dialog.locator('.content-submit-actions button[type="submit"]')).toBeInViewport();
      if (process.env.COMPOSER_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.COMPOSER_SCREENSHOTS_DIR}/${surface.path.slice(1)}-${width}.png` });
      if (width > 640) {
        await dialog.getByRole("button", { name: en.ContentComposer.expand }).click();
        await expect(dialog).toHaveClass(/content-composer-expanded/);
        await expect(input).toHaveValue("A reflection to preserve");
      } else {
        const bounds = await dialog.boundingBox();
        expect(bounds!.width).toBeCloseTo(width, 0);
        expect(bounds!.height).toBeCloseTo(1000, 0);
      }
      await dialog.getByRole("button", { name: en.Common.cancel, exact: true }).click();
      const confirm = page.getByRole("dialog", { name: en.ContentComposer.unsavedTitle });
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: en.ContentComposer.keepEditing }).click();
      await expect(input).toHaveValue("A reflection to preserve");
      await dialog.getByRole("button", { name: en.ContentComposer.close }).click();
      await confirm.getByRole("button", { name: en.ContentComposer.discard, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test("failed post publishing keeps text and blocks duplicate submissions", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.route("**/api/posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
  let requests = 0;
  let release: () => void = () => {};
  const responseGate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/posts", async route => { requests++; await responseGate; await route.fulfill({ status: 500, json: { error: "server_error" } }); });
  await page.goto("/posts");
  await page.getByRole("button", { name: en.ContentComposer.newpost, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: en.ContentComposer.newpost, exact: true });
  const text = dialog.getByPlaceholder(en.PostsPage.composePlaceholder);
  await text.fill("Keep this reflection after a failed request.");
  await dialog.getByRole("button", { name: en.ContentComposer.publish, exact: true }).click();
  await expect(dialog.getByRole("button", { name: en.ContentComposer.close })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: en.ContentComposer.workingShort, exact: true })).toBeDisabled();
  release();
  await expect(dialog.getByRole("button", { name: en.ContentComposer.publish, exact: true })).toBeEnabled();
  await expect(text).toHaveValue("Keep this reflection after a failed request.");
  expect(requests).toBe(1);
});


test("guest entry points preserve their return page and unverified editors cannot submit", async ({ page }) => {
  for (const surface of surfaces) {
    await page.goto(`${surface.path}?q=practice`);
    const action = page.locator(".page-header-action").getByRole("link", { name: en.ContentComposer.signInToCreate });
    await expect(action).toHaveAttribute("href", new RegExp(`callbackUrl=${encodeURIComponent(surface.path + '?q=practice')}`));
  }
  await mockAuthenticatedApp(page);
  await page.route("**/api/auth/session**", route => route.fulfill({ json: { user: { id: "test-user-1", name: "Test User", emailVerifiedAt: null }, expires: "2099-01-01T00:00:00Z" } }));
  await page.goto("/gallery");
  await page.locator(".page-header-action").getByRole("button", { name: en.ContentComposer.newalbum }).click();
  const dialog = page.getByRole("dialog", { name: en.ContentComposer.newalbum, exact: true });
  await expect(dialog).toContainText(en.Auth.verifyEmail.unverifiedDesc);
  await expect(dialog.getByRole("button", { name: en.ContentComposer.publish, exact: true })).toBeDisabled();
});

for (const surface of surfaces) {
  test(`${surface.path} publishes through the shared composer and updates its feed`, async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.route(`**${surface.endpoint}?**`, route => route.fulfill({ json: { posts: [], hasMore: false } }));
    let submitted: Record<string, unknown> | undefined;
    await page.route(`**${surface.endpoint}`, async route => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: {
        ...submitted, id: "created-content", shortId: "new12345", slug: "a-community-reflection",
        isPublic: true, language: "en", createdAt: "2026-10-27T07:00:00Z", updatedAt: "2026-10-27T07:00:00Z",
        publishedAt: null, coverUrl: null, categories: [], media: [], items: [], itemCount: 0, blogPost: null, blogPostId: null,
        channel: { id: "test-channel-1", name: "Test User", slug: "test-user", ownerId: "test-user-1", avatarUrl: null },
      } });
    });
    await page.goto(surface.path);
    await page.locator(".page-header-action").getByRole("button", { name: surface.label, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: surface.label, exact: true });
    await dialog.getByPlaceholder(surface.placeholder, { exact: true }).fill("A community reflection");
    if (surface.path === "/blog") await dialog.locator('[contenteditable="true"]').fill("A moment of devotion shared with the community.");
    if (surface.path === "/gallery") await dialog.getByPlaceholder(en.Gallery.descriptionPlaceholder).fill("A gathering to remember.");
    await dialog.getByRole("button", { name: en.ContentComposer.publish, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(submitted).toMatchObject({ channelId: "test-channel-1", language: "en", isPublic: true });
    await expect(page.getByRole("main")).toContainText("A community reflection");
    await expect(page.getByText(en.ContentComposer.publishedNotice, { exact: true })).toBeVisible();
  });
}
