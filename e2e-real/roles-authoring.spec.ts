import messages from "../messages/en.json";
import { expect, test } from "./fixtures";
import { CHANNEL_ROLE_EDITOR } from "@/lib/channel-roles";
import {
  cleanupUsersByEmail,
  createUserWithChannel,
  fillComposer,
  loginViaUi,
  prisma,
  uniqueE2EEmail,
} from "./helpers";

test("editor can switch identity, create and edit posts, but cannot open settings", async ({ page }) => {
  const ownerEmail = uniqueE2EEmail("editor-owner");
  const editorEmail = uniqueE2EEmail("editor-author");
  const ownerName = `E2E Editorial Channel ${Date.now()}`;
  const editorName = `E2E Editor ${Date.now()}`;
  const [owner, editor] = await Promise.all([
    createUserWithChannel({ name: ownerName, email: ownerEmail, isPersonal: false }),
    createUserWithChannel({ name: editorName, email: editorEmail, verified: true }),
  ]);

  await prisma.channelEditor.create({
    data: {
      channelId: owner.channel.id,
      userId: editor.user.id,
      role: CHANNEL_ROLE_EDITOR,
    },
  });

  try {
    await loginViaUi(page, editorEmail);

    await page.getByRole("button", { name: /Switch identity:/ }).last().click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText(ownerName)).toBeVisible();
    await expect(menu.getByText(/^Editor$/)).toBeVisible();
    await page.getByRole("menuitemradio").filter({ hasText: ownerName }).click();
    await expect(page.getByRole("button", { name: `Switch identity: ${ownerName}` })).toBeVisible();

    const content = `Editor-created post ${Date.now()}`;
    const composer = await fillComposer(page, content);
    await composer.getByRole("button", { name: messages.ContentComposer.publish, exact: true }).click();
    await expect(composer).not.toBeVisible();
    await expect(page.getByText(content).first()).toBeVisible();

    let post: { id: string } | null = null;
    await expect.poll(async () => {
      post = await prisma.post.findFirst({
        where: { channelId: owner.channel.id, content },
        select: { id: true },
      });
      return Boolean(post);
    }).toBe(true);

    await page.getByRole("button", { name: "Edit post" }).first().click();
    const updated = `${content} edited`;
    const dialog = page.getByRole("dialog");
    await dialog.locator("textarea").fill(updated);
    await dialog.getByRole("button", { name: messages.ContentComposer.saveChanges, exact: true }).first().click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(updated).first()).toBeVisible();
    await expect.poll(async () => {
      const saved = await prisma.post.findUnique({
        where: { id: post!.id },
        select: { content: true },
      });
      return saved?.content;
    }).toBe(updated);

    await page.goto(`/channels/${owner.slug}/settings`);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  } finally {
    await page.close();
    await cleanupUsersByEmail([ownerEmail, editorEmail]);
  }
});
