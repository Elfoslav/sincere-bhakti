import { type Locator, type Page, expect } from "@playwright/test";

const TEST_USER = {
  email: "test@example.com",
  password: "testpassword",
};

export async function login(page: Page) {
  await page.goto("/en/login");
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname !== "/en/login");
  await page.waitForLoadState("networkidle");
}

export async function openEditModal(page: Page) {
  const editButton = page.locator('[aria-label="Edit post"]');
  await expect(editButton).toBeVisible();
  await editButton.click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function goToPostPage(page: Page, postId: string) {
  await page.goto(`/en/posts/${postId}`);
  await page.waitForLoadState("load");
}

export async function switchToPreviewTab(dialog: Locator) {
  await dialog.locator("button:has-text('Preview')").click();
  await dialog.locator('[role="tabpanel"]:not([inert])').waitFor({ state: "visible", timeout: 3000 });
}

export function editPostPreviewPanel(dialog: Locator) {
  return dialog.locator('[data-slot="tabs-panel"]').nth(1);
}

export function delayPatchRequest(page: Page, postId: string): { resolve: () => void } {
  let resolveDelay: () => void;
  const delay = new Promise<void>((resolve) => { resolveDelay = resolve; });
  page.route(`**/api/posts/${postId}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    await delay;
    await route.continue();
  });
  return { resolve: () => resolveDelay() };
}
