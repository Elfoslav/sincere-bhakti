import { test, expect } from "@playwright/test";
import sharp from "sharp";
import en from "../messages/en.json";

test("publishes scalable browser icons and an opaque home-screen icon", async ({ page, request }) => {
  await page.goto("/en/login", { waitUntil: "domcontentloaded" });
  const icon = page.locator('link[rel="icon"][type="image/svg+xml"]');
  await expect(icon).toHaveAttribute("href", /icon\.svg/);
  const svg = await request.get((await icon.getAttribute("href"))!);
  expect(svg.ok()).toBe(true);
  expect(svg.headers()["content-type"]).toContain("image/svg+xml");
  expect(await svg.text()).not.toMatch(/🪷|<text/);
  const apple = page.locator('link[rel="apple-touch-icon"]');
  const png = await request.get((await apple.getAttribute("href"))!);
  expect(png.ok()).toBe(true);
  const metadata = await sharp(await png.body()).metadata();
  expect(metadata.width).toBe(180); expect(metadata.height).toBe(180);
  const ico = await request.get("/favicon.ico");
  expect(ico.ok()).toBe(true);
  expect((await ico.body()).readUInt16LE(4)).toBe(5);
});

test("auth pages and footer share the vector lotus while preserving the original logo", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/en/login", { waitUntil: "domcontentloaded" });
    const lotus = page.locator("main .lotus-icon");
    await expect(lotus).toHaveCount(1);
    await expect(lotus).toBeVisible();
    await expect(lotus).toHaveAttribute("aria-hidden", "true");
    expect(await lotus.evaluate((el) => getComputedStyle(el).maskImage)).toContain("/images/lotus.svg");
    await expect(page.locator("footer .lotus-icon")).toBeVisible();
    await expect(page.getByRole("navigation").first().getByRole("img", { name: en.Navbar.logoAlt })).toHaveAttribute("src", /sincere-bhakti-logo/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("main")).not.toContainText("🪷");
  }
});
