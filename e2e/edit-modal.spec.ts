import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { login, openEditModal, goToPostPage, switchToPreviewTab, editPostPreviewPanel, delayPatchRequest } from "./helpers";

let seededPostId: string;

test.beforeAll(async () => {
  const DATABASE_URL = process.env.TEST_DATABASE_URL;
  if (!DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.media.deleteMany();
  await prisma.pendingUpload.deleteMany();
  await prisma.channelSlugHistory.deleteMany();
  await prisma.channelEditor.deleteMany();
  await prisma.post.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.rateLimit.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("testpassword", 4);
  const user = await prisma.user.create({
    data: { name: "Test User", email: "test@example.com", password: hashedPassword },
  });

  const channel = await prisma.channel.create({
    data: { name: "Test User", normalizedName: "test user", slug: "test-user", ownerId: user.id, isPersonal: true },
  });

  const post = await prisma.post.create({
    data: {
      content: "Test post with media 🕉️",
      isPublic: true,
      language: "en",
      channelId: channel.id,
      media: {
        create: [
          { url: "https://pub-6d16aed4258e49b2819f39081b390f64.r2.dev/test-image.png", type: "image", position: 0, width: 800, height: 600, userId: user.id },
          { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", type: "youtube", position: 1, userId: user.id },
        ],
      },
    },
  });

  seededPostId = post.id;
  await prisma.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("opens edit modal from post detail page", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);
  await expect(dialog.locator("text=Edit post")).toBeVisible();
});

test("edit modal shows post content and media", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  await expect(dialog.locator("textarea")).toHaveValue(/Test post with media/);
  await expect(dialog.locator("text=test-image.png").first()).toBeVisible();
});

test("removing media in edit tab removes it from preview", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  const mediaItems = dialog.locator('[draggable="true"]');
  const initialCount = await mediaItems.count();
  expect(initialCount).toBeGreaterThanOrEqual(1);

  await dialog.locator("button:has-text('✕')").first().click();
  await expect(dialog.locator('[draggable="true"]')).toHaveCount(initialCount - 1);

  await switchToPreviewTab(dialog);
  await expect(dialog.locator("text=test-image.png")).toHaveCount(0);
});

test("preview tab reflects content edits", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator("textarea").fill("Edited content - Hare Krishna!");
  await switchToPreviewTab(dialog);

  await expect(editPostPreviewPanel(dialog).locator("p:has-text('Edited content - Hare Krishna!')")).toBeVisible();
});

test("preview tab shows visibility badge changes", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator('[role="switch"]').click();
  await switchToPreviewTab(dialog);

  await expect(editPostPreviewPanel(dialog).locator("text=Private")).toBeVisible();
});

test("saving edits updates the post content", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator("textarea").fill("Updated via Playwright test");
  await dialog.locator("button:has-text('Save')").first().click();

  await expect(dialog).not.toBeVisible();
  await expect(page.locator("text=Updated via Playwright test")).toBeVisible();
});

test("saving from preview tab submits the form", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator("textarea").fill("Saved from preview tab");
  await switchToPreviewTab(dialog);

  await editPostPreviewPanel(dialog).locator("button:has-text('Save')").click();

  await expect(dialog).not.toBeVisible();
  await expect(page.locator("text=Saved from preview tab")).toBeVisible();
});

test("cancel from preview tab closes the modal", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  await switchToPreviewTab(dialog);
  await editPostPreviewPanel(dialog).locator("button:has-text('Cancel')").click();

  await expect(dialog).not.toBeVisible();
});

test("write tab save button shows loading state during submission", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator("textarea").fill("Loading state test");

  const patch = delayPatchRequest(page, seededPostId);
  await dialog.locator('form button[type="submit"]').click();
  await page.waitForTimeout(200);

  const saveButton = dialog.locator('form button[type="submit"]');
  await expect(saveButton).toHaveText("Posting...");
  await expect(saveButton).toBeDisabled();

  patch.resolve();
  await expect(dialog).not.toBeVisible();
});

test("preview tab save button shows loading state during submission", async ({ page }) => {
  await goToPostPage(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator("textarea").fill("Preview loading state test");
  await switchToPreviewTab(dialog);

  const patch = delayPatchRequest(page, seededPostId);
  await editPostPreviewPanel(dialog).locator('button[type="submit"]').click();
  await page.waitForTimeout(200);

  const saveButton = editPostPreviewPanel(dialog).locator('button[type="submit"]');
  await expect(saveButton).toHaveText("Posting...");
  await expect(saveButton).toBeDisabled();

  patch.resolve();
  await expect(dialog).not.toBeVisible();
});
