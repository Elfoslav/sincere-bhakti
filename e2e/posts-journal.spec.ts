import { test, expect, type Page } from "@playwright/test";
import type { Post } from "../src/types/post";
import en from "../messages/en.json";

const channel = { id: "journal-channel", name: "Journal community", slug: "journal-community", ownerId: "journal-owner", avatarUrl: null };
const base: Post = { id: "journal-text", shortId: "jrnltext", slug: "reflection", content: "A journal reflection without a photo.", media: [], categories: [], channel, language: "en", isPublic: true, publishedAt: null, createdAt: "2026-10-20T09:00:00Z", blogPost: null, blogPostId: null };
const posts: Post[] = [
  { ...base, id: "journal-photo", shortId: "jrnlphoto", content: "A quiet morning in our community.\n\nA journal moment with room for a photograph and a reflection.", media: [{ url: "/images/article-tulsi.jpg", type: "image", width: 1200, height: 800, position: 0 }] },
  base,
  { ...base, id: "journal-media", shortId: "jrnlmedia", content: null, media: [{ url: "/images/article-community.jpg", type: "image", width: null, height: null, position: 0 }] },
];

async function openJournal(page: Page, width = 1440, fixturePosts = posts) {
  await page.setViewportSize({ width, height: 1000 });
  await page.route("**/api/posts?**", route => route.fulfill({ json: {
    posts: new URL(route.request().url()).searchParams.get("q") === "journal" ? fixturePosts : [],
    hasMore: false,
  } }));
  await page.goto("/en/posts?q=journal");
  await expect(page.getByText("A journal reflection without a photo.", { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".journal-post[data-has-media]")).toHaveCount(3);
}

for (const width of [1440, 768, 767, 390, 320]) {
  test(`community journal keeps mixed content readable at ${width}px`, async ({ page }, testInfo) => {
    await openJournal(page, width);
    await expect(page.locator(".journal-container")).toBeVisible();
    const row = page.locator(".journal-post").first();
    const text = await row.locator(".post-card-copy").boundingBox();
    const media = await row.locator(".post-card-media").boundingBox();
    if (width >= 768) expect(media!.x).toBeGreaterThanOrEqual(text!.x + text!.width);
    else {
      expect(media!.y).toBeGreaterThanOrEqual(text!.y + text!.height);
      expect(media!.width).toBeCloseTo((await row.boundingBox())!.width, 0);
      expect(text!.width).toBeCloseTo(media!.width, 0);
      await page.screenshot({ path: testInfo.outputPath("stacked-mobile-post.png") });
    }
    const sidebar = page.getByRole("complementary", { name: en.PostsPage.journalLabel });
    if (width >= 768) {
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole("link", { name: /Journal community/ })).toHaveCount(1);
    } else await expect(sidebar).toBeHidden();
    const textOnly = page.locator('.journal-post[data-has-media="false"]');
    expect((await textOnly.locator(".post-card-copy").boundingBox())!.width).toBeGreaterThan((await textOnly.boundingBox())!.width - 2);
    const photoOnly = page.locator('.journal-post[data-has-copy="false"]');
    await expect(photoOnly.getByRole("button", { name: en.PostCard.openImage })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("journal photos retain full lightboxes, real detail links, and search URLs", async ({ page }) => {
  await openJournal(page);
  await expect(page).toHaveURL(/q=journal/);
  const row = page.locator(".journal-post").first();
  await expect(row.getByRole("link", { name: en.PostCard.openPost }).first()).toHaveAttribute("href", /jrnlphoto/);
  await row.getByRole("button", { name: en.PostCard.openImage }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").locator("img")).toHaveAttribute("src", "/images/article-tulsi.jpg");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`viewer Close and Back preserve the page at ${width}px`, async ({ page }, testInfo) => {
    await page.goto("/en/login");
    const previousUrl = page.url();
    await openJournal(page, width);
    const url = page.url();
    const opener = page.locator(".journal-post").first().getByRole("button", { name: en.PostCard.openImage });
    // A transformed or clipped card must never constrain the viewer.
    await page.locator(".journal-post").first().evaluate(element => {
      element.style.transform = "translateZ(0)";
      element.style.overflow = "hidden";
    });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: en.MediaLightbox.title });
    const close = dialog.getByRole("button", { name: en.MediaLightbox.close, exact: true });
    await expect(close).toBeVisible();
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await dialog.boundingBox())!.width).toBe(width);
    await page.screenshot({ path: testInfo.outputPath("viewer.png") });
    // Check actual hit testing: visible controls can still be covered by media.
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect.poll(() => page.evaluate(() => Boolean(history.state?.mediaLightbox))).toBe(false);
    await opener.click();
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(url);
    await expect(opener).toBeFocused();
    await opener.click();
    await close.click();
    await expect.poll(() => page.evaluate(() => Boolean(history.state?.mediaLightbox))).toBe(false);
    await page.goBack();
    await expect(page).toHaveURL(previousUrl);
  });
}

for (const width of [390, 1440]) {
  test(`post videos expand into a closable viewer at ${width}px`, async ({ page }) => {
    await page.route("**/test-video.mp4", route => route.fulfill({ status: 404, body: "" }));
    await openJournal(page, width, posts.map((post, i) => i === 0 ? {
      ...post, media: [...post.media, { url: "/test-video.mp4", type: "video", position: 1, width: 640, height: 360 }],
    } : post));
    await page.getByRole("button", { name: en.MediaLightbox.expandVideo }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("video")).toHaveAttribute("playsinline", "");
    await expect(dialog.locator("video")).toHaveAttribute("src", "/test-video.mp4");
    await dialog.getByRole("button", { name: en.MediaLightbox.close, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/q=journal/);
  });
}

test.describe("mobile gallery swipes", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("native touch swipes navigate photos without closing or changing page history", async ({ page }) => {
    const urls = ["/images/article-tulsi.jpg", "/images/article-community.jpg", "/images/vrindavan-dawn.jpg"];
    await openJournal(page, 390, posts.map((post, i) => i === 0 ? {
      ...post, media: urls.map((url, position) => ({ url, type: "image", position, width: 1200, height: 800 })),
    } : post));
    const opener = page.locator(".journal-post").first().getByRole("button", { name: en.PostCard.openImage }).first();
    await opener.tap();
    const dialog = page.getByRole("dialog", { name: en.MediaLightbox.title });
    const photo = dialog.locator("img");
    await expect(photo).toHaveAttribute("src", urls[0]);
    const historyLength = await page.evaluate(() => history.length);
    const url = page.url();
    const client = await page.context().newCDPSession(page);
    async function swipe(direction: "left" | "right" | "down") {
      const bounds = (await photo.boundingBox())!;
      const y = bounds.y + bounds.height / 2;
      const startX = bounds.x + bounds.width * (direction === "left" ? 0.75 : 0.25);
      const endX = direction === "down" ? startX : bounds.x + bounds.width * (direction === "left" ? 0.25 : 0.75);
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y }] });
      for (let step = 1; step <= 6; step++) {
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: startX + (endX - startX) * step / 6, y: y + (direction === "down" ? step * 15 : 0) }] });
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await swipe("left");
    await expect(photo).toHaveAttribute("src", urls[1]);
    await swipe("down");
    await expect(photo).toHaveAttribute("src", urls[1]);
    await swipe("left");
    await expect(photo).toHaveAttribute("src", urls[2]);
    await swipe("left");
    await expect(photo).toHaveAttribute("src", urls[2]);
    await swipe("right");
    await expect(photo).toHaveAttribute("src", urls[1]);
    await swipe("right");
    await expect(photo).toHaveAttribute("src", urls[0]);
    await swipe("right");
    await expect(photo).toHaveAttribute("src", urls[0]);
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    await dialog.getByRole("button", { name: en.MediaLightbox.close, exact: true }).tap();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Boolean(history.state?.mediaLightbox))).toBe(false);
    await opener.tap();
    await swipe("left");
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(url);
  });
});
