import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./helpers";
import { CHANNEL_ROLE_OWNER } from "../src/lib/channel-roles";
import en from "../messages/en.json";

const personal = { id: "personal", name: "Madhava Dasa", slug: "madhava", avatarUrl: null, ownerId: "test-user-1", isPersonal: true, role: CHANNEL_ROLE_OWNER };
const community = { ...personal, id: "community", name: "Vrindavan Community and Devotional Gatherings", slug: "community", isPersonal: false };

for (const width of [1440, 390]) {
  test(`new post switches posting identity without losing the draft at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockAuthenticatedApp(page);
    let activeChannelId = personal.id;
    let rejectSwitch = false;
    let releaseSwitch!: () => void;
    const switchGate = new Promise<void>(resolve => { releaseSwitch = resolve; });
    await page.route("**/api/identity**", async route => {
      if (route.request().method() === "PATCH") {
        await switchGate;
        if (rejectSwitch) return route.fulfill({ status: 500, json: { error: "server_error" } });
        activeChannelId = route.request().postDataJSON().channelId;
      }
      await route.fulfill({ json: { activeChannelId, identities: [personal, community] } });
    });
    await page.route("**/api/posts?**", route => route.fulfill({ json: { posts: [], hasMore: false } }));
    let submitted: Record<string, unknown> | undefined;
    let releasePublish!: () => void;
    const publishGate = new Promise<void>(resolve => { releasePublish = resolve; });
    await page.route("**/api/posts", async route => {
      if (route.request().method() !== "POST") return route.continue();
      submitted = route.request().postDataJSON();
      await publishGate;
      await route.fulfill({ status: 201, json: {
        ...submitted, id: "created-post", shortId: "new12345", slug: "a-community-reflection", isPublic: true, language: "en",
        createdAt: "2026-10-30T07:00:00Z", publishedAt: null, categories: [], media: [], blogPost: null, blogPostId: null,
        channel: community,
      } });
    });
    await page.goto("/posts");
    await page.getByRole("button", { name: en.ContentComposer.newpost, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: en.ContentComposer.newpost, exact: true });
    const draft = dialog.getByPlaceholder(en.PostsPage.composePlaceholder, { exact: true });
    await draft.fill("A reflection to preserve while switching identity.");
    const personalTrigger = dialog.getByRole("button", { name: `${en.Identity.switchLabel}: ${personal.name}`, exact: true });
    await expect(personalTrigger).toContainText(en.ContentComposer.postingAs);
    await personalTrigger.click();
    const menu = page.getByRole("menu", { name: en.Identity.switchLabel });
    await expect(menu).toBeVisible();
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(menu.getByRole("menuitem", { name: en.Identity.manage })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("posting-identity.png") });
    await menu.getByRole("menuitemradio", { name: new RegExp(community.name) }).click();
    const publish = dialog.getByRole("button", { name: en.ContentComposer.publish, exact: true });
    await expect(publish).toBeDisabled();
    releaseSwitch();
    const communityTrigger = dialog.getByRole("button", { name: `${en.Identity.switchLabel}: ${community.name}`, exact: true });
    await expect(communityTrigger).toBeEnabled();
    await expect(menu).toHaveCount(0);
    await expect(draft).toHaveValue("A reflection to preserve while switching identity.");
    // A failed switch must not silently change where the draft will publish.
    rejectSwitch = true;
    await communityTrigger.click();
    await menu.getByRole("menuitemradio", { name: new RegExp(personal.name) }).click();
    await expect(menu.getByRole("alert")).toHaveText(en.Identity.switchFailed);
    await expect(menu.getByRole("menuitemradio", { name: new RegExp(community.name) })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(communityTrigger).toBeFocused();
    await publish.click();
    await expect.poll(() => submitted?.channelId).toBe(community.id);
    await expect(communityTrigger).toBeDisabled();
    expect(submitted?.content).toBe("A reflection to preserve while switching identity.");
    releasePublish();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
