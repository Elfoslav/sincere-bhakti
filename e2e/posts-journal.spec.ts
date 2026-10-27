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

async function openJournal(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.route("**/api/posts?**", route => route.fulfill({ json: {
    posts: new URL(route.request().url()).searchParams.get("q") === "journal" ? posts : [],
    hasMore: false,
  } }));
  await page.goto("/en/posts?q=journal");
  await expect(page.getByText("A journal reflection without a photo.", { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".journal-post[data-has-media]")).toHaveCount(3);
}

for (const width of [1440, 768, 390, 320]) {
  test(`community journal keeps mixed content readable at ${width}px`, async ({ page }) => {
    await openJournal(page, width);
    await expect(page.locator(".journal-container")).toBeVisible();
    const row = page.locator(".journal-post").first();
    const text = await row.locator(".post-card-copy").boundingBox();
    const media = await row.locator(".post-card-media").boundingBox();
    if (width >= 360) expect(media!.x).toBeGreaterThanOrEqual(text!.x + text!.width);
    else expect(media!.y).toBeGreaterThanOrEqual(text!.y + text!.height);
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
