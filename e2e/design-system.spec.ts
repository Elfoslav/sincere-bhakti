import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { BlogPost } from "../src/types/blog";
import { observeDesignErrors, measureTextContrast } from "./design-helpers";

const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  browserErrors.set(page, observeDesignErrors(page));
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), "browser runtime and console errors").toEqual([]);
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // The menu trigger is a hydration signal only at mobile widths where it is
  // visible. Desktop flows wait for their own content or interactive control.
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await expect(page.locator('nav button[aria-expanded]').first()).toBeEnabled({ timeout: 60000 });
  }
  if (path.endsWith("/design-system")) {
    // Base UI registers its roving focus list after this route hydrates,
    // independently of the navigation's earlier hydration boundary.
    await expect(page.getByRole("tab", { selected: true })).toHaveAttribute("tabindex", "0", { timeout: 30000 });
  }
  await expect(page).toHaveTitle(/Sincere Bhakti/);
  await expect(page.locator("main")).not.toBeEmpty();
  await expect(page.locator("nextjs-portal").getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.head.append(style);
  });
}

// Browser plugin not available. Installed Chrome runs sequential browser checks.
for (const locale of ["en", "cs", "sk"]) {
  test(`${locale} homepage preserves identity, links and mobile layout`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, `/${locale}`);
    await expect(page.locator("h1")).toHaveText("Sincere Bhakti");
    await expect(page.locator('nav img[alt="Sincere Bhakti"]')).toBeVisible();
    await expect(page.locator('main a[href$="/register"]')).toBeVisible();
    const toggle = page.locator('nav button[aria-expanded]').first();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("nav [inert]")).toHaveCount(1);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("nav [inert]")).toHaveCount(0);
    const posts = page.locator('nav a[href$="/posts"]').last();
    await posts.click();
    await expect(page).toHaveURL(/\/posts$/, { timeout: 60000 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("gallery uses live tokens, supports keyboard tabs, forms and dialogs", async ({ page }) => {
  await gotoReady(page, "/en/design-system");
  await expect(page.getByRole("heading", { name: "Design system", exact: true })).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "--primary" }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Foundations" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Components" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Components" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Disabled", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Madhava das");
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Madhava das");
  await page.getByRole("switch", { name: "Public", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Public", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("essential text and action token pairs meet AA contrast in both palettes", async ({ page }) => {
  await gotoReady(page, "/en/design-system");
  for (const dark of [false, true]) {
    const colors = await page.evaluate((isDark) => {
      document.documentElement.classList.toggle("dark", isDark);
      const resolveColor = (name: string) => {
        // Resolve CSS aliases through a real element so var() references work.
        const probe = document.createElement("span");
        probe.style.color = `var(--${name})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      return [["foreground", "background"], ["muted-foreground", "background"], ["primary-foreground", "primary"], ["destructive-foreground", "destructive"]].map(([a,b]) => {
        return { foreground: resolveColor(a), background: resolveColor(b) };
      });
    }, dark);
    for (const ratio of await measureTextContrast(page, colors)) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});

test("homepage renders without overflow and respects reduced motion", async ({ page }) => {
  await mkdir("output/design", { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1122, height: 1402 });
  const articlesResponse = page.waitForResponse(response => response.url().includes("/api/blog-posts?") && response.status() === 200);
  await gotoReady(page, "/en");
  const articles = await (await articlesResponse).json();
  if (articles.posts?.length) await expect(page.locator("#home-blog-heading")).toBeVisible({ timeout: 30000 });
  await page.locator(".home-hero-media img").evaluate((img: HTMLImageElement) => img.decode());
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.screenshot({ path: "output/design/home-concept-size.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".home-hero-media img")).toBeVisible();
  await page.locator(".home-hero-media img").evaluate((img: HTMLImageElement) => img.decode());
  await page.screenshot({ path: "output/design/home-desktop.png", fullPage: true });
  expect(await page.locator(".reveal-in").evaluate(el => parseFloat(getComputedStyle(el).animationDuration))).toBeLessThan(0.01);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/design/home-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("gallery components render without mobile overflow", async ({ page }) => {
  await mkdir("output/design", { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReady(page, "/en/design-system");
  await page.getByRole("tab", { name: "Components" }).click();
  await expect(page.getByRole("heading", { name: "Actions & states" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "output/design/components-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "output/design/components-desktop.png", fullPage: true });
});

test("coverless articles use compact editorial rows", async ({ page }) => {
  await mkdir("output/design", { recursive: true });
  await page.route("**/api/blog-posts?**", async route => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.posts.length, "real local articles are required for visual verification").toBeGreaterThan(0);
    await route.fulfill({ response, json: { ...body, posts: body.posts.map((post: BlogPost) => ({ ...post, coverUrl: null })) } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page, "/en");
  const grid = page.locator('.editorial-grid[data-featured-media="false"]');
  await expect(grid).toBeVisible({ timeout: 60000 });
  await expect(grid.locator(".media-zoom")).toHaveCount(0);
  const rows = await grid.locator(":scope > *").evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  for (const [index, row] of rows.entries()) {
    expect(row.width).toBeGreaterThan(900);
    expect(row.height).toBeLessThan(320);
    if (index) expect(row.y).toBeGreaterThanOrEqual(rows[index - 1].y + rows[index - 1].height);
  }
  await grid.screenshot({ path: "output/design/coverless-articles-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await grid.screenshot({ path: "output/design/coverless-articles-mobile.png" });
});
