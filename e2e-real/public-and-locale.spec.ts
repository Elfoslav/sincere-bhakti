import { expect, test } from "./fixtures";
import {
  cleanupUsersByEmail,
  createPostForChannel,
  createUserWithChannel,
  uniqueE2EEmail,
} from "./helpers";

test("anonymous users can open public posts, author channels, and public author metadata", async ({ page }) => {
  const email = uniqueE2EEmail("anonymous-public");
  const name = `E2E Public Author ${Date.now()}`;
  const { user, channel, slug } = await createUserWithChannel({ name, email });
  const content = `Anonymous visible public post ${Date.now()}`;
  const post = await createPostForChannel({ channelId: channel.id, content });

  try {
    await page.goto("/posts");
    await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
    await expect(page.getByText(content)).toBeVisible();

    await page.goto(`/posts/${post.id}`);
    await expect(page.getByRole("main").getByText(content)).toBeVisible();

    await page.goto(`/channels/${slug}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText(content)).toBeVisible();

    const profile = await page.request.get(`/api/users/${user.id}`);
    expect(profile.ok()).toBe(true);
    const publicUser = await profile.json();
    expect(publicUser).toMatchObject({ id: user.id, name });
    expect(publicUser).not.toHaveProperty("email");
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});

test("post lists are filtered by the active locale", async ({ page }) => {
  const email = uniqueE2EEmail("locale-author");
  const name = `E2E Locale Author ${Date.now()}`;
  const { channel } = await createUserWithChannel({ name, email });
  const enContent = `English locale post ${Date.now()}`;
  const csContent = `Czech locale post ${Date.now()}`;
  await Promise.all([
    createPostForChannel({ channelId: channel.id, content: enContent, language: "en" }),
    createPostForChannel({ channelId: channel.id, content: csContent, language: "cs" }),
  ]);

  try {
    await page.goto("/posts");
    await expect(page.getByText(enContent)).toBeVisible();
    await expect(page.getByText(csContent)).toHaveCount(0);

    await page.goto("/cs/posts");
    await expect(page.getByText(csContent)).toBeVisible();
    await expect(page.getByText(enContent)).toHaveCount(0);
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
