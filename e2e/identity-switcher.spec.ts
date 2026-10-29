import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers";
import { CHANNEL_ROLE_OWNER } from "../src/lib/channel-roles";
import en from "../messages/en.json";

for (const width of [1470, 1024, 390, 320]) {
  test(`identity menu matches the header and switches identities at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockAuthenticatedApp(page);
    const personal = { id: "personal", name: "Madhava Dasa", slug: "madhava", avatarUrl: null, ownerId: "test-user-1", isPersonal: true, role: CHANNEL_ROLE_OWNER };
    const community = { ...personal, id: "community", name: "Vrindavan Community and Devotional Gatherings", slug: "community", avatarUrl: "/images/article-tulsi.jpg", isPersonal: false };
    let activeChannelId = personal.id;
    let rejectSwitch = false;
    await page.route("**/api/identity**", async route => {
      if (route.request().method() === "PATCH") {
        if (rejectSwitch) return route.fulfill({ status: 500, json: { error: "server_error" } });
        activeChannelId = route.request().postDataJSON().channelId;
      }
      await route.fulfill({ json: { activeChannelId, identities: [personal, community] } });
    });
    await page.route("**/api/posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
    await page.goto("/en/posts");
    const trigger = page.getByRole("button", { name: `${en.Identity.switchLabel}: ${personal.name}`, exact: true });
    await expect(trigger).toBeVisible();
    const triggerBox = (await trigger.boundingBox())!;
    const headerBox = (await page.locator("nav").first().boundingBox())!;
    expect(triggerBox.x).toBeGreaterThanOrEqual(0);
    expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(width);
    expect(triggerBox.y + triggerBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
    if (width >= 1024) {
      await expect(trigger.locator(".identity-name")).toHaveCSS("font-family", await page.locator("h1").evaluate(el => getComputedStyle(el).fontFamily));
      await expect(trigger).toContainText(en.Identity.activeLabel);
      const language = (await page.getByRole("button", { name: en.Common.language }).boundingBox())!;
      expect(language.x + language.width).toBeLessThanOrEqual(triggerBox.x);
    } else {
      const logo = (await page.getByRole("link", { name: en.Navbar.logoAlt, exact: true }).boundingBox())!;
      const toggle = (await page.getByRole("button", { name: en.Navbar.toggleMenu }).boundingBox())!;
      expect(logo.x + logo.width).toBeLessThanOrEqual(triggerBox.x);
      expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(toggle.x);
    }
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu", { name: en.Identity.switchLabel });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("opacity", "1");
    await expect(menu.getByRole("menuitemradio", { name: new RegExp(personal.name) })).toHaveAttribute("aria-checked", "true");
    const menuBox = (await menu.boundingBox())!;
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);
    await expect(menu.getByRole("menuitemradio", { name: new RegExp(personal.name) })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitemradio", { name: new RegExp(community.name) })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await menu.getByRole("menuitemradio", { name: new RegExp(community.name) }).click();
    const switched = page.getByRole("button", { name: `${en.Identity.switchLabel}: ${community.name}`, exact: true });
    await expect(switched).toBeVisible();
    await expect(menu).toHaveCount(0);
    await switched.click();
    await expect(menu.getByRole("menuitemradio", { name: new RegExp(community.name) })).toHaveAttribute("aria-checked", "true");
    await expect(menu).toHaveCSS("opacity", "1");
    if (process.env.IDENTITY_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.IDENTITY_SCREENSHOTS_DIR}/identity-${width}.png`, clip: { x: 0, y: 0, width, height: 420 } });
    rejectSwitch = true;
    await menu.getByRole("menuitemradio", { name: new RegExp(personal.name) }).click();
    await expect(menu).toBeVisible();
    await expect(switched).toBeVisible();
    await expect(menu.getByRole("menuitemradio", { name: new RegExp(community.name) })).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("contentinfo").click({ position: { x: 8, y: 8 } });
    await expect(menu).toHaveCount(0);
  });
}
