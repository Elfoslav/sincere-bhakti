import { test, expect } from "@playwright/test";
import en from "../messages/en.json";

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`Posts and Blog share headings, search layout and filtering controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/categories?**", route => route.fulfill({ json: {
      categories: [{ id: "reflection", name: "Reflection", slug: "reflection", language: "en" }],
    } }));
    await page.route("**/api/posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
    await page.route("**/api/blog-posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));

    const layouts = [];
    const headingStyles = [];
    for (const path of ["/posts", "/blog"]) {
      await page.goto(`${path}?q=devotion`);
      const heading = page.getByRole("heading", { level: 1 });
      const header = page.locator("main .page-header");
      const subtitle = header.locator(":scope > div:first-child > p");
      const action = header.locator(".page-header-action");
      await expect(subtitle).toBeVisible();
      await expect(header.locator(":scope > div:first-child > p")).toHaveCount(1);
      await expect(heading).toHaveCSS("text-align", "center");
      await expect(subtitle).toHaveCSS("text-align", "center");
      const titleBox = (await heading.boundingBox())!;
      expect(Math.abs(titleBox.x + titleBox.width / 2 - width / 2)).toBeLessThan(1);
      const actionBox = (await action.boundingBox())!;
      const subtitleBox = (await subtitle.boundingBox())!;
      if (width < 1024) expect(actionBox.y).toBeGreaterThanOrEqual(subtitleBox.y + subtitleBox.height);
      else expect(actionBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width);
      headingStyles.push(await header.evaluate(element => {
        const title = getComputedStyle(element.querySelector("h1")!);
        const subtitle = getComputedStyle(element.querySelector("p")!);
        const header = getComputedStyle(element);
        return { titleFont: title.font, letterSpacing: title.letterSpacing, subtitleFont: subtitle.font, subtitleColor: subtitle.color, gap: header.gap, marginBottom: header.marginBottom, top: element.getBoundingClientRect().top };
      }));
      if (process.env.FEED_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.FEED_SCREENSHOTS_DIR}/${path.slice(1)}-${width}.png` });
      const search = page.getByRole("search");
      const input = search.getByRole("searchbox");
      const category = search.getByRole("link", { name: "Reflection", exact: true });
      await expect(input).toHaveValue("devotion");
      await expect(category).toBeVisible();
      await expect(input).toHaveAttribute("aria-busy", "false");
      await expect(input).toHaveCSS("padding-right", "40px");
      await expect(category).toHaveAttribute("href", `${path}/category/reflection?q=devotion`);
      const inputBox = (await input.boundingBox())!;
      const searchBox = (await search.boundingBox())!;
      const categoryBox = (await category.boundingBox())!;
      expect(categoryBox.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height);
      expect(Math.abs(inputBox.x + inputBox.width / 2 - searchBox.x - searchBox.width / 2)).toBeLessThan(1);
      layouts.push(await input.evaluate(element => {
        const style = getComputedStyle(element);
        return { width: element.getBoundingClientRect().width, height: style.height, font: style.font, padding: style.padding, borderRadius: style.borderRadius };
      }));
      await search.getByRole("button", { name: en.Common.clearSearch }).click();
      await expect(input).toHaveValue("");
      await expect(page).not.toHaveURL(/q=/);
      await expect(category).toHaveAttribute("href", `${path}/category/reflection`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(layouts[0]).toEqual(layouts[1]);
    expect(headingStyles[0]).toEqual(headingStyles[1]);
  });
}
