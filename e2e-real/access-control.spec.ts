import { expect, test } from "@playwright/test";
import { CHANNEL_ROLE_ADMIN, CHANNEL_ROLE_EDITOR } from "@/lib/channel-roles";
import {
  clearSession,
  cleanupUsersByEmail,
  createPostForChannel,
  createUserWithPersonalChannel,
  loginViaUi,
  prisma,
  uniqueE2EEmail,
} from "./helpers";

test("private posts are visible only to the channel author", async ({ page }) => {
  const ownerEmail = uniqueE2EEmail("private-owner");
  const otherEmail = uniqueE2EEmail("private-other");
  const ownerName = `E2E Private Owner ${Date.now()}`;
  const otherName = `E2E Private Other ${Date.now()}`;
  const [{ channel }] = await Promise.all([
    createUserWithPersonalChannel({ name: ownerName, email: ownerEmail }),
    createUserWithPersonalChannel({ name: otherName, email: otherEmail }),
  ]);
  const content = `Private real database post ${Date.now()}`;
  const post = await createPostForChannel({ channelId: channel.id, content, isPublic: false });

  try {
    await page.goto(`/posts/${post.id}`);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

    await loginViaUi(page, ownerEmail);
    await page.goto(`/posts/${post.id}`);
    await expect(page.getByRole("main").getByText(content)).toBeVisible();

    await clearSession(page);
    await loginViaUi(page, otherEmail);
    await page.goto(`/posts/${post.id}`);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  } finally {
    await page.close();
    await cleanupUsersByEmail([ownerEmail, otherEmail]);
  }
});

test("channel settings are available to owners and admins, not editors or outsiders", async ({ page }) => {
  const ownerEmail = uniqueE2EEmail("settings-owner");
  const adminEmail = uniqueE2EEmail("settings-admin");
  const editorEmail = uniqueE2EEmail("settings-editor");
  const outsiderEmail = uniqueE2EEmail("settings-outsider");
  const ownerName = `E2E Settings Owner ${Date.now()}`;
  const adminName = `E2E Settings Admin ${Date.now()}`;
  const editorName = `E2E Settings Editor ${Date.now()}`;
  const outsiderName = `E2E Settings Outsider ${Date.now()}`;
  const [owner, admin, editor] = await Promise.all([
    createUserWithPersonalChannel({ name: ownerName, email: ownerEmail }),
    createUserWithPersonalChannel({ name: adminName, email: adminEmail }),
    createUserWithPersonalChannel({ name: editorName, email: editorEmail }),
    createUserWithPersonalChannel({ name: outsiderName, email: outsiderEmail }),
  ]);

  await prisma.channelEditor.createMany({
    data: [
      { channelId: owner.channel.id, userId: admin.user.id, role: CHANNEL_ROLE_ADMIN },
      { channelId: owner.channel.id, userId: editor.user.id, role: CHANNEL_ROLE_EDITOR },
    ],
  });

  try {
    await loginViaUi(page, adminEmail);
    await page.goto(`/channels/${owner.channel.slug}/settings`);
    await expect(page.getByRole("heading", { name: "Channel settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admins and editors" })).toBeVisible();

    await clearSession(page);
    await loginViaUi(page, editorEmail);
    await page.goto(`/channels/${owner.channel.slug}/settings`);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

    await clearSession(page);
    await loginViaUi(page, outsiderEmail);
    await page.goto(`/channels/${owner.channel.slug}/settings`);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  } finally {
    await page.close();
    await cleanupUsersByEmail([ownerEmail, adminEmail, editorEmail, outsiderEmail]);
  }
});
