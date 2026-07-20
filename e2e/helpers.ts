import { type Locator, type Page, type Route, expect } from "@playwright/test";

const TEST_USER = {
  id: "test-user-1",
  email: "test@example.com",
  name: "Test User",
};

const TEST_CHANNEL = {
  id: "test-channel-1",
  name: "Test User",
  slug: "test-user",
  avatarUrl: null,
  ownerId: TEST_USER.id,
  isPersonal: true,
  role: "owner",
};

export async function mockAuthenticatedApp(page: Page) {
  await page.route("**/api/auth/session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: TEST_USER.id,
          name: TEST_USER.name,
          email: TEST_USER.email,
          channelId: TEST_CHANNEL.id,
        },
        expires: "2099-01-01T00:00:00.000Z",
      }),
    });
  });

  await page.route("**/api/identity**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        activeChannelId: TEST_CHANNEL.id,
        identities: [TEST_CHANNEL],
      }),
    });
  });
}

export async function openEditModal(page: Page) {
  const editButton = page.getByTestId("open-edit-modal");
  await expect(editButton).toBeVisible();
  await expect(editButton).toBeEnabled();
  await editButton.click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function goToEditPostHarness(page: Page, postId: string) {
  await page.goto(`/en/e2e/edit-post?postId=${postId}`);
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
    await fulfillPatchRequest(route);
  });
  return { resolve: () => resolveDelay() };
}

export async function mockPostPatch(page: Page, postId: string) {
  await page.route(`**/api/posts/${postId}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    await fulfillPatchRequest(route);
  });
}

async function fulfillPatchRequest(route: Route) {
  const body = route.request().postDataJSON() as {
    content?: string | null;
    isPublic?: boolean;
    media?: Array<{ url: string; type: string; width?: number | null; height?: number | null }>;
  };

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: "test-post-1",
      content: body.content ?? null,
      isPublic: body.isPublic ?? true,
      language: "en",
      createdAt: "2026-07-19T12:00:00.000Z",
      channel: {
        id: TEST_CHANNEL.id,
        name: TEST_CHANNEL.name,
        slug: TEST_CHANNEL.slug,
        avatarUrl: TEST_CHANNEL.avatarUrl,
        ownerId: TEST_CHANNEL.ownerId,
      },
      media: (body.media ?? []).map((item, position) => ({
        url: item.url,
        type: item.type,
        position,
        width: item.width ?? null,
        height: item.height ?? null,
      })),
    }),
  });
}
