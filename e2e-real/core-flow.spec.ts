import { expect, test } from "@playwright/test";
import {
  cleanupUsersByEmail,
  createUserWithPersonalChannel,
  loginViaUi,
  prisma,
  uniqueE2EEmail,
} from "./helpers";

test("owner can use crucial authenticated pages with the real database", async ({ page }) => {
  const email = uniqueE2EEmail("owner-flow");
  const name = `E2E Owner ${Date.now()}`;
  const { channel, slug } = await createUserWithPersonalChannel({ name, email });

  try {
    await loginViaUi(page, email);

    const content = `Real database post ${Date.now()}`;
    await page.getByPlaceholder(/Share your realization/).fill(content);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByText(content)).toBeVisible();

    let post: { id: string } | null = null;
    await expect.poll(async () => {
      post = await prisma.post.findFirst({
        where: { content, channelId: channel.id },
        select: { id: true },
      });
      return Boolean(post);
    }).toBe(true);

    await page.goto(`/posts/${post!.id}`);
    await expect(page.getByRole("main").getByText(content)).toBeVisible();

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.goto(`/channels/${slug}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.goto(`/channels/${slug}/settings`);
    await expect(page.getByRole("heading", { name: "Channel settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admins and editors" })).toBeVisible();
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
