import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers";
import en from "../messages/en.json";
import sk from "../messages/sk.json";

test("mobile navigation dismisses in layers and closes on outside input", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/login");
  const toggle = page.getByRole("button", { name: en.Navbar.toggleMenu });
  await expect(toggle).toBeEnabled();
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  const mobile = page.locator("#mobile-navigation");
  const language = mobile.getByRole("button", { name: en.Common.language, exact: true });
  await language.click();
  await page.getByRole("menuitemradio").first().focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole("main").getByRole("heading").click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await mobile.getByRole("link", { name: en.Navbar.getIn, exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("mobile search keeps focus after clearing and supports Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/blog-posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
  await page.goto("/en/blog?q=bhakti");
  const search = page.getByRole("searchbox");
  await expect(search).toHaveValue("bhakti");
  const clear = page.getByRole("button", { name: en.Common.clearSearch });
  expect((await clear.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await clear.click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await search.fill("kirtan");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
});

for (const locale of ["en", "sk"] as const) {
  test(`${locale} dialog close remains reachable in a short viewport`, async ({ page }, testInfo) => {
    const messages = locale === "sk" ? sk : en;
    await page.setViewportSize({ width: 844, height: 260 });
    await page.goto(`/${locale}/design-system`);
    await expect(page.getByRole("tab", { selected: true })).toHaveAttribute("tabindex", "0");
    await page.getByRole("tab", { name: messages.DesignSystem.components, exact: true }).click();
    const trigger = page.getByRole("button", { name: messages.DesignSystem.openDialog, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    const close = dialog.getByRole("button", { name: messages.MediaLightbox.close, exact: true });
    await expect(close).toBeInViewport();
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(260);
    // Long translated text and small screens must not scroll Close out of reach.
    await dialog.evaluate(element => {
      element.querySelector('[data-slot="dialog-description"]')!.textContent = "Long dialog description. ".repeat(100);
      element.scrollTop = element.scrollHeight;
    });
    await expect(close).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("short-dialog.png") });
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test("category Escape closes suggestions before asking to discard a draft", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.route("**/api/posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
  await page.route("**/api/categories?**", route => route.fulfill({ json: { categories: [] } }));
  await page.goto("/posts");
  await page.getByRole("button", { name: en.ContentComposer.newpost, exact: true }).click();
  const editor = page.getByRole("dialog", { name: en.ContentComposer.newpost, exact: true });
  await editor.getByPlaceholder(en.PostsPage.composePlaceholder, { exact: true }).fill("A reflection to keep");
  const categories = editor.getByRole("combobox");
  await categories.fill("bhakti");
  await expect(editor.getByRole("listbox")).toBeVisible();
  await categories.press("Escape");
  await expect(editor.getByRole("listbox")).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(page.getByRole("dialog", { name: en.ContentComposer.unsavedTitle })).toHaveCount(0);
  await categories.press("Escape");
  const confirm = page.getByRole("dialog", { name: en.ContentComposer.unsavedTitle });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: en.ContentComposer.keepEditing, exact: true }).click();
  await expect(editor.getByPlaceholder(en.PostsPage.composePlaceholder, { exact: true })).toHaveValue("A reflection to keep");
});
