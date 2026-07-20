import { test, expect } from "@playwright/test";
import {
  delayPatchRequest,
  editPostPreviewPanel,
  goToEditPostHarness,
  mockAuthenticatedApp,
  mockPostPatch,
  openEditModal,
  switchToPreviewTab,
} from "./helpers";

const seededPostId = "test-post-1";

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedApp(page);
});

test("opens edit modal from DB-free edit post harness", async ({ page }) => {
  await goToEditPostHarness(page, seededPostId);
  const dialog = await openEditModal(page);
  await expect(dialog.locator("text=Edit post")).toBeVisible();
});

test("edit modal shows post content and media", async ({ page }) => {
  await goToEditPostHarness(page, seededPostId);
  const dialog = await openEditModal(page);

  await expect(dialog.locator("textarea")).toHaveValue(/Test post with media/);
  await expect(dialog.locator("text=test-image.png").first()).toBeVisible();
});

test("removing media in edit tab removes it from preview", async ({ page }) => {
  await goToEditPostHarness(page, seededPostId);
  const dialog = await openEditModal(page);

  const mediaItems = dialog.locator('[draggable="true"]');
  const initialCount = await mediaItems.count();
  expect(initialCount).toBeGreaterThanOrEqual(1);

  await dialog.getByRole("button", { name: "Remove media" }).first().click();
  await expect(dialog.locator('[draggable="true"]')).toHaveCount(initialCount - 1);

  await switchToPreviewTab(dialog);
  await expect(dialog.locator("text=test-image.png")).toHaveCount(0);
});

test("preview tab reflects content edits", async ({ page }) => {
  await goToEditPostHarness(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator("textarea").fill("Edited content - Hare Krishna!");
  await switchToPreviewTab(dialog);

  await expect(editPostPreviewPanel(dialog).locator("p:has-text('Edited content - Hare Krishna!')")).toBeVisible();
});

test("preview tab shows visibility badge changes", async ({ page }) => {
  await goToEditPostHarness(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator('[role="switch"]').click();
  await switchToPreviewTab(dialog);

  await expect(editPostPreviewPanel(dialog).locator("text=Private")).toBeVisible();
});

test("saving edits updates the post content", async ({ page }) => {
  await mockPostPatch(page, seededPostId);
  await goToEditPostHarness(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator("textarea").fill("Updated via Playwright test");
  await dialog.locator("button:has-text('Save')").first().click();

  await expect(dialog).not.toBeVisible();
  await expect(page.locator("text=Updated via Playwright test")).toBeVisible();
});

test("saving from preview tab submits the form", async ({ page }) => {
  await mockPostPatch(page, seededPostId);
  await goToEditPostHarness(page, seededPostId);
  const dialog = await openEditModal(page);

  await dialog.locator("textarea").fill("Saved from preview tab");
  await switchToPreviewTab(dialog);

  await editPostPreviewPanel(dialog).locator("button:has-text('Save')").click();

  await expect(dialog).not.toBeVisible();
  await expect(page.locator("text=Saved from preview tab")).toBeVisible();
});

test("cancel from preview tab closes the modal", async ({ page }) => {
  await goToEditPostHarness(page, seededPostId);
  const dialog = await openEditModal(page);

  await switchToPreviewTab(dialog);
  await editPostPreviewPanel(dialog).locator("button:has-text('Cancel')").click();

  await expect(dialog).not.toBeVisible();
});

test("write tab save button shows loading state during submission", async ({ page }) => {
  await goToEditPostHarness(page, seededPostId);
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
  await goToEditPostHarness(page, seededPostId);
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
