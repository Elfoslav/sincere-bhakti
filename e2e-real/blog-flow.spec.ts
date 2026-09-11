import { expect, test } from "@playwright/test";
import {
  cleanupUsersByEmail,
  createUserWithPersonalChannel,
  loginViaUi,
  prisma,
  uniqueE2EEmail,
} from "./helpers";

test("author publishes a formatted article with a timeline promo", async ({ page }) => {
  const email = uniqueE2EEmail("blog-flow");
  const name = `E2E Blogger ${Date.now()}`;
  const { user } = await createUserWithPersonalChannel({ name, email });
  // Blog creation requires a verified email; posts do not.
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

  const title = `E2E Article ${Date.now()}`;
  const excerpt = `E2E excerpt ${Date.now()}`;
  const bodyText = `E2E article body ${Date.now()}`;

  try {
    await loginViaUi(page, email);
    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();

    // Scope to <main>: the (closed) edit modal keeps a second hidden copy
    // of the form mounted in a body portal.
    const composer = page.getByRole("main");
    await composer.getByPlaceholder("Article title...").fill(title);
    await composer.getByPlaceholder("Short summary (optional)...").fill(excerpt);
    const editor = composer.locator(".tiptap");
    await editor.click();
    await composer.getByRole("button", { name: "Bold" }).click();
    await page.keyboard.type(bodyText);

    await composer.getByRole("switch", { name: "Publish in posts timeline" }).click();
    await composer.getByRole("button", { name: "Publish", exact: true }).click();

    // Article appears in the blog feed...
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    let article: { id: string; shortId: string } | null = null;
    await expect.poll(async () => {
      article = await prisma.blogPost.findFirst({
        where: { title },
        select: { id: true, shortId: true },
      });
      return Boolean(article);
    }).toBe(true);

    // ...with a promoting post in the timeline...
    await page.goto("/posts");
    await expect(page.getByText(title).first()).toBeVisible();

    // ...and the detail page renders the formatted body, not raw JSON.
    await page.goto("/blog");
    await page.getByRole("heading", { name: title }).click();
    await expect(page).toHaveURL(new RegExp(`/blog/${article!.shortId}`));
    await expect(page.getByRole("main").getByText(excerpt)).toBeVisible();
    await expect(page.getByRole("main").locator("strong", { hasText: bodyText })).toBeVisible();
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
