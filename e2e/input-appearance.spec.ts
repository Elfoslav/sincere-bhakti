import { test, expect } from "@playwright/test";

for (const { name, path, selector } of [
  { name: "form", path: "/en/login", selector: 'input[type="email"]' },
  { name: "search", path: "/en/blog", selector: '[role="searchbox"]' },
]) {
  test(`${name} placeholders are distinct and focus has one compact highlight`, async ({ page }) => {
    await page.goto(path);
    const field = page.locator(selector);
    await expect(field).toBeVisible();
    await field.focus();
    await expect(field).toBeFocused();
    const appearance = await field.evaluate((element) => {
      const style = getComputedStyle(element);
      const placeholder = getComputedStyle(element, "::placeholder");
      return {
        color: style.color,
        placeholderColor: placeholder.color,
        placeholderStyle: placeholder.fontStyle,
        outlineStyle: style.outlineStyle,
        ring: style.getPropertyValue("--tw-ring-shadow"),
      };
    });
    expect(appearance.placeholderColor).not.toBe(appearance.color);
    expect(appearance.placeholderStyle).toBe("italic");
    expect(appearance.outlineStyle).toBe("none");
    expect(appearance.ring).toContain("1px");
    expect(appearance.ring).not.toMatch(/[34]px/);
  });
}
