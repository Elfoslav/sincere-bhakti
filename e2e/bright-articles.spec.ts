import { test, expect } from "@playwright/test";
import en from "../messages/en.json";

test.setTimeout(60_000);

for (const width of [1470, 390]) {
  test(`bright article composition and local preview filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1070 });
    await page.goto("/en/design-preview?palette=saffron&presentation=1");
    await expect(page.getByRole("heading", { level: 1, name: en.BlogPage.title })).toBeVisible();
    await expect(page.getByRole("heading", { name: en.DesignPreview.article3 })).toBeVisible();
    const row = page.locator(".article-row").first();
    const cover = await row.locator(".article-row-media").boundingBox();
    const copy = await row.locator(".article-row-copy").boundingBox();
    expect(cover).not.toBeNull(); expect(copy).not.toBeNull();
    if (width > 640) { expect(cover!.width).toBeGreaterThan(350); expect(cover!.x + cover!.width).toBeLessThan(copy!.x); }
    else { expect(cover!.y + cover!.height).toBeLessThanOrEqual(copy!.y); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: en.DesignPreview.categorycommunity, exact: true }).click();
    await expect(page.locator(".article-row")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: en.DesignPreview.article2 })).toBeVisible();
    await page.getByRole("link", { name: en.Categories.all, exact: true }).click();
    await page.getByRole("searchbox").fill("remembrance");
    await expect(page.locator(".article-row")).toHaveCount(1);
    await page.getByRole("searchbox").fill("zzzz-no-match");
    await expect(page.locator(".article-row")).toHaveCount(0);
    await expect(page.getByRole("status")).toBeVisible();
  });
}

for (const width of [1470, 390, 320]) {
  test(`article feed shows only author covers and gives coverless text full width at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/missing-article-cover.jpg", route => route.fulfill({ status: 404, body: "" }));
    const base = { id: "one", shortId: "abc12345", slug: "real-reflection", title: "Real reflection", excerpt: "A summary", contentHtml: "<p>A reflection</p>", content: "A reflection", coverUrl: null, isPublic: true, publishedAt: null, createdAt: "2026-10-20T09:00:00Z", categories: [], channel: { id: "c", name: "Community", slug: "community", ownerId: "o", avatarUrl: null } };
    await page.route("**/api/blog-posts?**", route => route.fulfill({ json: { posts: new URL(route.request().url()).searchParams.get("q") === "reflection" ? [
      base,
      { ...base, id: "two", shortId: "abc12346", title: "An author cover", coverUrl: "/images/vrindavan-dawn.jpg" },
      { ...base, id: "three", shortId: "abc12347", title: "An unavailable cover", coverUrl: "/missing-article-cover.jpg" },
    ] : [], hasMore: false } }));
    await page.goto("/en/blog?q=reflection");
    await expect(page.locator("main .article-feed-container")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Real reflection", exact: true })).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveAttribute("aria-busy", "false");
    for (const title of ["Real reflection", "An unavailable cover"]) {
      const row = page.locator(".article-row").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute("data-has-cover", "false");
      await expect(row.locator("img, .article-row-media")).toHaveCount(0);
      await expect(row.locator(".article-row-excerpt")).toHaveText("A summary");
      const geometry = await row.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const copy = element.querySelector(".article-row-copy")!.getBoundingClientRect();
        return { x: bounds.x, width: bounds.width, copyX: copy.x, copyWidth: copy.width };
      });
      expect(geometry.copyX).toBeCloseTo(geometry.x, 0);
      expect(geometry.copyWidth).toBeGreaterThanOrEqual(geometry.width - 2);
    }
    const coverRow = page.locator(".article-row").filter({ has: page.getByRole("heading", { name: "An author cover", exact: true }) });
    const cover = coverRow.locator("img");
    await expect(cover).toHaveAttribute("src", "/images/vrindavan-dawn.jpg");
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const media = (await coverRow.locator(".article-row-media").boundingBox())!;
    const copy = (await coverRow.locator(".article-row-copy").boundingBox())!;
    if (width > 640) expect(media.x + media.width).toBeLessThan(copy.x);
    else expect(media.y + media.height).toBeLessThanOrEqual(copy.y);
    await expect(page.locator('.article-row a[href*="abc12345"]').first()).toHaveAttribute("href", /real-reflection/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 254, 252)");
    if (process.env.FEED_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.FEED_SCREENSHOTS_DIR}/coverless-${width}.png`, fullPage: true });
  });
}

test("header and articles fit small phones and tablet widths", async ({ page }) => {
  await page.goto("/en/design-preview?palette=saffron&presentation=1");
  for (const width of [320, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`).toBe(true);
    const header = page.locator('nav').first();
    const logo = await header.getByRole("link", { name: en.Navbar.logoAlt, exact: true }).boundingBox();
    const toggle = header.getByRole("button", { name: en.Navbar.toggleMenu });
    if (width < 1024) {
      await expect(toggle).toBeVisible();
      const menu = await toggle.boundingBox();
      expect(logo!.x + logo!.width).toBeLessThanOrEqual(menu!.x);
    } else await expect(toggle).toBeHidden();
  }
});

test("article redesign preserves the original logo and font families", async ({ page }) => {
  await page.goto("/en/design-preview?palette=saffron&presentation=1");
  const logo = page.getByRole("navigation").first().getByRole("img", { name: en.Navbar.logoAlt });
  await expect(logo).toHaveAttribute("src", /sincere-bhakti-logo/);
  await expect(logo).toBeVisible();
  const fonts = await page.evaluate(() => {
    const probe = document.createElement("span"); document.body.append(probe);
    probe.className = "font-heading";
    const heading = getComputedStyle(probe).fontFamily;
    probe.className = "";
    probe.style.fontFamily = "var(--font-sans)";
    const body = getComputedStyle(probe).fontFamily;
    probe.remove();
    return { heading, body, title: getComputedStyle(document.querySelector(".article-row-title")!).fontFamily, excerpt: getComputedStyle(document.querySelector(".article-row-excerpt")!).fontFamily };
  });
  expect(fonts.title).toBe(fonts.heading);
  expect(fonts.excerpt).toBe(fonts.body);
});
