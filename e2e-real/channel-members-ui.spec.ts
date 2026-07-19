import { expect, test } from "@playwright/test";
import { CHANNEL_ROLE_ADMIN, CHANNEL_ROLE_EDITOR } from "@/lib/channel-roles";
import {
  clearSession,
  cleanupUsersByEmail,
  createUserWithPersonalChannel,
  loginViaUi,
  prisma,
  uniqueE2EEmail,
} from "./helpers";

test("owner can add a member as editor and update them to admin from the settings UI", async ({ page }) => {
  const ownerEmail = uniqueE2EEmail("member-owner");
  const memberEmail = uniqueE2EEmail("member-user");
  const ownerName = `E2E Member Owner ${Date.now()}`;
  const memberName = `E2E Member User ${Date.now()}`;
  const [owner] = await Promise.all([
    createUserWithPersonalChannel({ name: ownerName, email: ownerEmail }),
    createUserWithPersonalChannel({ name: memberName, email: memberEmail }),
  ]);

  try {
    await loginViaUi(page, ownerEmail);
    await page.goto(`/channels/${owner.channel.slug}/settings`);
    await expect(page.getByRole("heading", { name: "Channel settings" })).toBeVisible();

    const addMemberForm = page.getByRole("button", { name: "Add member" }).locator("..");
    await addMemberForm.getByPlaceholder("User email").fill(memberEmail);
    await addMemberForm.locator("select").selectOption(CHANNEL_ROLE_EDITOR);
    await addMemberForm.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByRole("button").filter({ hasText: memberEmail })).toBeVisible();
    await expect(page.getByText("Editor").last()).toBeVisible();

    await page.getByRole("button").filter({ hasText: memberEmail }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Edit member")).toBeVisible();
    await dialog.locator("select").selectOption(CHANNEL_ROLE_ADMIN);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button").filter({ hasText: memberEmail }).getByText("Admin")).toBeVisible();

    await expect.poll(async () => {
      const memberUser = await prisma.user.findUnique({
        where: { email: memberEmail },
        select: { id: true },
      });
      const member = await prisma.channelEditor.findUnique({
        where: { channelId_userId: { channelId: owner.channel.id, userId: memberUser!.id } },
        select: { role: true },
      });
      return member?.role;
    }).toBe(CHANNEL_ROLE_ADMIN);

    await clearSession(page);
    await loginViaUi(page, memberEmail);
    await page.goto(`/channels/${owner.channel.slug}/settings`);
    await expect(page.getByRole("heading", { name: "Channel settings" })).toBeVisible();
  } finally {
    await page.close();
    await cleanupUsersByEmail([ownerEmail, memberEmail]);
  }
});
