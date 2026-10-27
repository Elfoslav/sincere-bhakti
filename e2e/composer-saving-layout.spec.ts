import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers";
import en from "../messages/en.json";

for (const width of [1440, 390]) {
  test(`saving an article keeps editor and action positions stable at ${width}px`, async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/blog-posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
    let release: () => void = () => {};
    const responseGate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/blog-posts", async route => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      await responseGate;
      await route.fulfill({ status: 500, json: { error: "server_error" } });
    });
    await page.goto("/blog");
    await page.locator(".page-header-action").getByRole("button", { name: en.ContentComposer.newarticle }).click();
    const dialog = page.getByRole("dialog", { name: en.ContentComposer.newarticle, exact: true });
    await dialog.getByPlaceholder(en.BlogPage.titlePlaceholder, { exact: true }).fill("A steady saving experience");
    await dialog.locator('[contenteditable="true"]').fill("A reflection to save without moving the editor actions.");
    const cancel = dialog.getByRole("button", { name: en.Common.cancel, exact: true });
    const publish = dialog.getByRole("button", { name: en.ContentComposer.publish, exact: true });
    await publish.scrollIntoViewIfNeeded();
    const before = { dialog: (await dialog.boundingBox())!, cancel: (await cancel.boundingBox())!, submit: (await publish.boundingBox())! };
    await publish.click();
    const saving = dialog.getByRole("button", { name: en.ContentComposer.workingShort, exact: true });
    await expect(saving).toBeDisabled();
    await expect(cancel).toBeDisabled();
    await expect(dialog.getByRole("status")).toHaveText(en.ContentComposer.working);
    const during = { dialog: (await dialog.boundingBox())!, cancel: (await cancel.boundingBox())!, submit: (await saving.boundingBox())! };
    expect(during.dialog).toEqual(before.dialog);
    expect(during.cancel).toEqual(before.cancel);
    expect(during.submit.y).toBe(before.submit.y);
    expect(during.submit.height).toBe(before.submit.height);
    const status = (await dialog.getByRole("status").boundingBox())!;
    expect(status.width).toBeLessThanOrEqual(1);
    expect(status.height).toBeLessThanOrEqual(1);
    await expect(saving).toBeInViewport();
    release();
    await expect(publish).toBeEnabled();
    await expect(cancel).toBeEnabled();
    await expect(dialog.getByRole("status")).toBeEmpty();
    await expect(dialog.getByPlaceholder(en.BlogPage.titlePlaceholder, { exact: true })).toHaveValue("A steady saving experience");
  });
}
