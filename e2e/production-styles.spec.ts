import { test, expect } from "@playwright/test";

// Run against `next start` as well as dev: stale production CSS can load with
// HTTP 200 while omitting the layout rules used by the current HTML.
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`homepage stylesheet matches its markup at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const hero = page.locator(".home-hero");
    await expect(hero).toHaveCSS("display", "flex");
    await expect(hero.locator(".home-hero-media")).toHaveCSS("position", "absolute");
    await expect(hero.locator("h1")).toBeVisible();
    expect(await hero.locator("h1").evaluate((heading) =>
      Number.parseFloat(getComputedStyle(heading).fontSize),
    )).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
