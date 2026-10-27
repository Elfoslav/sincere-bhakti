import { test, expect } from "@playwright/test";
import { measureTextContrast } from "./design-helpers";
import { DESIGN_PALETTES } from "../src/lib/design-palettes";
import en from "../messages/en.json";

test("failed article search retries and the query survives reload", async ({ page }) => {
  await page.goto("/en/blog");
  let fail = true;
  await page.route("**/api/blog-posts?**", (route) => route.fulfill({ status: fail ? 500 : 200, contentType: "application/json", body: JSON.stringify(fail ? { error: "server_error" } : { posts: [], hasMore: false }) }));
  const search = page.getByRole("searchbox");
  await search.fill("krishna");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(en.Common.feedLoadError);
  await expect(page).toHaveURL(/q=krishna/);
  fail = false;
  await page.getByRole("button", { name: en.Common.retry, exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Nothing found");
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("krishna");
  await search.fill("krishna bhakti");
  await expect(page.getByRole("searchbox")).toHaveValue("krishna bhakti");
  await expect(page).toHaveURL(/q=krishna\+bhakti/);
});

test("registration associates errors, focuses invalid fields, and reveals passwords", async ({ page }) => {
  await page.goto("/en/register");
  await page.getByRole("button", { name: en.Auth.register.button, exact: true }).click();
  const name = page.getByLabel(en.Auth.register.nameLabel, { exact: true });
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAccessibleDescription(new RegExp(en.Auth.register.nameRequired));
  const password = page.getByLabel(en.Auth.register.passwordLabel, { exact: true });
  await password.fill("examplePassword");
  await expect(page.locator("#register-password-hint")).toBeVisible();
  await page.getByRole("button", { name: en.Common.showPassword }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: en.Common.hidePassword }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("language menu supports keyboard dismissal and full names", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/en/blog?q=krishna");
  const trigger = page.getByRole("button", { name: en.Common.language, exact: true });
  await trigger.click();
  await expect(page.getByRole("menuitemradio", { name: /Čeština/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("channel discovery fetches real activity sorting and recovers from network errors", async ({ page }) => {
  await page.goto("/en/channels");
  const response = page.waitForResponse((res) => res.url().includes("/api/channels?") && res.url().includes("sort=active"));
  await page.getByLabel(en.ChannelsPage.sortLabel).selectOption("active");
  expect((await response).status()).toBe(200);
  await expect(page.getByRole("main")).not.toContainText(en.ChannelsPage.loadError);
  await page.route("**/api/channels?**", (route) => route.abort());
  await page.getByRole("searchbox").fill("network failure");
  await expect(page.getByRole("button", { name: en.ChannelsPage.retry })).toBeVisible();
  await page.unroute("**/api/channels?**");
  await page.getByRole("button", { name: en.ChannelsPage.retry }).click();
  await expect(page.getByRole("button", { name: en.ChannelsPage.retry })).toHaveCount(0);
});

for (const palette of Object.keys(DESIGN_PALETTES)) {
  test(`${palette} palette preview renders without horizontal overflow`, async ({ page }) => {
    await page.goto(`/en/design-preview?palette=${palette}`);
    await expect(page.locator(`input[value="${palette}"]`)).toBeChecked();
    const colors = DESIGN_PALETTES[palette as keyof typeof DESIGN_PALETTES];
    const ratios = await measureTextContrast(page, [
      { foreground: colors.foreground, background: colors.background },
      { foreground: colors["muted-foreground"], background: colors.background },
      { foreground: colors.primary, background: colors.background },
      { foreground: colors["primary-foreground"], background: colors.primary },
    ]);
    expect(ratios.every((ratio) => ratio >= 4.5), `palette text contrast: ${ratios}`).toBe(true);
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test("palette controls update the app and restore its colors when leaving the preview", async ({ page }) => {
  await page.goto("/en/design-preview?palette=tulsi");
  await page.locator('input[value="saffron"]').check();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background").trim())).toBe(DESIGN_PALETTES.saffron.background);
  await page.getByRole("tab", { name: en.DesignPreview.homepage, exact: true }).click();
  await expect(page.getByRole("heading", { name: en.HomePage.logoAlt, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: en.DesignPreview.articles, exact: true }).click();
  await expect(page.getByRole("heading", { name: en.DesignPreview.article1, exact: true })).toBeVisible();
  await page.getByRole("navigation").first().getByRole("link", { name: en.Navbar.posts, exact: true }).click();
  await expect(page).toHaveURL(/\/posts$/, { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--background"))).toBe("");
});
