import { expect, test } from "./fixtures";
import messages from "../messages/en.json";
import { getAlbumUrl } from "../src/lib/album-url";
import {
  cleanupUsersByEmail,
  createUserWithChannel,
  loginViaUi,
  openComposer,
  prisma,
  uniqueE2EEmail,
} from "./helpers";

test("author publishes and edits an album through the shared composer", async ({ page }) => {
  const email = uniqueE2EEmail("album-flow");
  const { channel } = await createUserWithChannel({ name: `E2E Album Author ${Date.now()}`, email, verified: true });
  const title = `E2E Album ${Date.now()}`;
  const description = "A gathering to remember.";

  try {
    await loginViaUi(page, email);
    await page.goto("/gallery");
    const composer = await openComposer(page, "album");
    await composer.getByPlaceholder(messages.Gallery.titlePlaceholder, { exact: true }).fill(title);
    await composer.getByPlaceholder(messages.Gallery.descriptionPlaceholder).fill(description);
    await composer.getByRole("button", { name: messages.ContentComposer.publish, exact: true }).click();
    await expect(composer).not.toBeVisible();
    await expect(page.getByRole("main").getByRole("heading", { name: title, exact: true })).toBeVisible();

    const album = await prisma.album.findFirstOrThrow({ where: { title, channelId: channel.id } });
    expect(album.description).toBe(description);
    expect(album.isPublic).toBe(true);
    await page.goto(getAlbumUrl(album.shortId, album.slug));
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: messages.Gallery.editAlbum, exact: true }).click();
    const edit = page.getByRole("dialog");
    const updatedTitle = `${title} edited`;
    await edit.getByPlaceholder(messages.Gallery.titlePlaceholder, { exact: true }).fill(updatedTitle);
    await edit.getByRole("button", { name: messages.ContentComposer.saveChanges, exact: true }).click();
    await expect(edit).not.toBeVisible();
    await expect(page.getByRole("heading", { name: updatedTitle, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: updatedTitle, exact: true })).toBeVisible();
    expect((await prisma.album.findUniqueOrThrow({ where: { id: album.id } })).title).toBe(updatedTitle);
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
