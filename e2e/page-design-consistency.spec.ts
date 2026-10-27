import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import messages from "../messages/en.json";
import { getBlogUrl } from "../src/lib/blog-url";
import { getPostUrl } from "../src/lib/post-url";
import { getAlbumUrl } from "../src/lib/album-url";
import { observeDesignErrors, measureTextContrast } from "./design-helpers";
import { CHANNEL_ROLE_OWNER, CHANNEL_ROLE_ADMIN } from "../src/lib/channel-roles";
import type { AuthorableIdentity } from "../src/types/identity";

const screenshotDirectory = process.env.DESIGN_SCREENSHOT_DIR ?? "/tmp/sincere-bhakti-design-audit";
const browserErrors = new WeakMap<Page, string[]>();
const pages = [
  { name: "posts", path: "/en/posts", container: "reading-container" },
  { name: "blog", path: "/en/blog", container: "article-feed-container" },
  { name: "gallery", path: "/en/gallery", container: "reading-container" },
  { name: "channels", path: "/en/channels", container: "site-container" },
  { name: "login", path: "/en/login", container: "auth-layout" },
  { name: "register", path: "/en/register", container: "auth-layout" },
  { name: "forgot-password", path: "/en/forgot-password", container: "auth-layout" },
  { name: "reset-password", path: "/en/reset-password", container: "auth-layout" },
  { name: "verify-email", path: "/en/verify-email", container: "auth-layout" },
  { name: "terms", path: "/en/terms", container: "reading-container" },
  { name: "privacy", path: "/en/privacy/krishna-chaitanya-mandir", container: "reading-container" },
  { name: "not-found", path: "/en/missing-design-audit-page", container: "auth-layout" },
];

test.beforeEach(async ({ page }, testInfo) => {
  browserErrors.set(page, observeDesignErrors(page, { expectedDocument404: testInfo.title.startsWith("not-found ") }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mkdir(screenshotDirectory, { recursive: true });
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), "unexpected console or runtime errors").toEqual([]);
});

for (const entry of pages) {
  test(`${entry.name} shares page foundations on desktop and mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(entry.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main h1")).toHaveCount(1, { timeout: 60000 });
    await expect(page.locator(`main .${entry.container}`).first()).toBeVisible();
    await expect(page.locator("nextjs-portal").getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("main")).not.toBeEmpty();
    await expect(page).toHaveTitle(/.+/, { timeout: 60000 });
    await expect(page.locator("main .animate-pulse")).toHaveCount(0, { timeout: 60000 });
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${entry.name} horizontal overflow`).toBe(true);
      const palette = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = "var(--background)";
        document.body.append(probe);
        const expected = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return { actual: getComputedStyle(document.body).backgroundColor, expected };
      });
      expect(palette.actual).toBe(palette.expected);
      await page.screenshot({ path: `${screenshotDirectory}/${entry.name}-${viewport.name}.png`, caret: "initial", style: "nextjs-portal { display: none !important; }" });
    }
  });
}

test("authentication labels focus their fields and navigation remains consistent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/login", { waitUntil: "domcontentloaded" });
  await page.locator('label[for="login-email"]').click();
  await expect(page.getByRole("textbox", { name: messages.Auth.login.emailLabel })).toBeFocused();
  await page.getByRole("link", { name: messages.Auth.login.registerLink }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel(messages.Auth.register.nameLabel, { exact: true }).fill("Layout review");
  await page.getByLabel(messages.Auth.register.emailLabel, { exact: true }).fill("layout@example.test");
  await expect(page.getByLabel(messages.Auth.register.nameLabel, { exact: true })).toHaveValue("Layout review");
  await page.goto("/en/channels", { waitUntil: "domcontentloaded" });
  const toggle = page.getByRole("button", { name: messages.Navbar.toggleMenu });
  await expect(toggle).toBeEnabled({ timeout: 60000 });
  await toggle.click();
  const current = page.locator('#mobile-navigation a[aria-current="page"]');
  await expect(current).toHaveText(messages.Navbar.channels);
  await toggle.click();
  const search = page.getByRole("searchbox");
  await search.fill("bhakti");
  await page.getByRole("button", { name: messages.Common.clearSearch }).click();
  await expect(search).toHaveValue("");
});

test("real content detail pages retain shared reading containers", async ({ page, request }) => {
  const feeds = [
    { endpoint: "/api/posts?scope=public&limit=1&language=en", name: "post-detail", url: getPostUrl },
    { endpoint: "/api/blog-posts?scope=public&limit=1&language=en", name: "blog-detail", url: getBlogUrl },
    { endpoint: "/api/albums?scope=public&limit=1&language=en", name: "album-detail", url: getAlbumUrl },
  ];
  for (const feed of feeds) {
    const response = await request.get(feed.endpoint);
    expect(response.ok()).toBe(true);
    const body = await response.json();
    if (!body.posts?.length) {
      test.info().annotations.push({ type: "missing-local-content", description: feed.name });
      continue;
    }
    const entity = body.posts[0];
    await page.goto(`/en${feed.url(entity.shortId, entity.slug)}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main .reading-container").first()).toBeVisible({ timeout: 60000 });
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `${screenshotDirectory}/${feed.name}-${viewport.name}.png`, caret: "initial", style: "nextjs-portal { display: none !important; }" });
    }
  }
});

test("feedback remains readable on light and dark surfaces", async ({ page }) => {
  await page.goto("/en/design-system", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tab", { selected: true })).toHaveAttribute("tabindex", "0", { timeout: 60000 });
  await page.getByRole("tab", { name: "Components" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  for (const dark of [false, true]) {
    await page.evaluate(isDark => document.documentElement.classList.toggle("dark", isDark), dark);
    const colors = await page.locator('main [role="alert"], main [role="status"]').evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor };
    }));
    expect(colors.length).toBeGreaterThanOrEqual(2);
    for (const ratio of await measureTextContrast(page, colors)) expect(ratio).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `${screenshotDirectory}/feedback-${dark ? "dark" : "light"}.png`, fullPage: true, caret: "initial", style: "nextjs-portal { display: none !important; }" });
  }
});

test("authenticated profile and management pages share the design system", async ({ page }) => {
  test.setTimeout(360000);
  test.skip(!process.env.SINCERE_BHAKTI_EMAIL || !process.env.SINCERE_BHAKTI_PASSWORD, "Local review credentials are not configured");
  // Use the same CSRF-protected credentials endpoint as NextAuth's signIn.
  // Form interaction is exercised separately; this check inspects account UI.
  const csrfResponse = await page.request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBe(true);
  const { csrfToken } = await csrfResponse.json();
  const origin = new URL(csrfResponse.url()).origin;
  const signInResponse = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email: process.env.SINCERE_BHAKTI_EMAIL!,
      password: process.env.SINCERE_BHAKTI_PASSWORD!,
      callbackUrl: `${origin}/profile`,
    },
    headers: { Origin: origin, "X-Auth-Return-Redirect": "1" },
  });
  expect(signInResponse.ok()).toBe(true);
  const sessionResponse = await page.request.get("/api/auth/session");
  expect(Boolean((await sessionResponse.json())?.user?.id)).toBe(true);

  const response = await page.request.get("/api/identity?language=en");
  expect(response.ok()).toBe(true);
  const { identities } = await response.json() as { identities: AuthorableIdentity[] };
  const manageable = identities.find(identity => identity.role === CHANNEL_ROLE_OWNER || identity.role === CHANNEL_ROLE_ADMIN);
  const routes = [
    { name: "profile", path: "/profile" },
    { name: "profile-settings", path: "/profile/settings" },
    ...(manageable ? [
      { name: "channel-detail", path: `/channels/${manageable.slug}` },
      { name: "channel-settings", path: `/channels/${manageable.slug}/settings` },
      { name: "channel-articles", path: `/blog/channel/${manageable.slug}` },
    ] : []),
  ];
  expect(manageable, "The review account needs a manageable channel").toBeDefined();
  for (const entry of routes) {
    await page.goto(`/en${entry.path}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main h1")).toHaveCount(1, { timeout: 60000 });
    await expect(page.locator("main .reading-container, main .article-feed-container").first()).toBeVisible();
    await expect(page.locator("main .animate-pulse")).toHaveCount(0, { timeout: 60000 });
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), entry.name).toBe(true);
      await page.screenshot({ path: `${screenshotDirectory}/${entry.name}-${viewport.name}.png`, caret: "initial", style: "nextjs-portal { display: none !important; }" });
    }
  }
});
