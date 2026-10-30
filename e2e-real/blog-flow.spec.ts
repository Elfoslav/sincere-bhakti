import messages from "../messages/en.json";
import { expect, test } from "./fixtures";
import {
  cleanupUsersByEmail,
  createUserWithChannel,
  loginViaUi,
  openComposer,
  prisma,
  uniqueE2EEmail,
} from "./helpers";

test("author publishes a formatted article with a timeline promo", async ({ page }) => {
  const email = uniqueE2EEmail("blog-flow");
  const name = `E2E Blogger ${Date.now()}`;
  await createUserWithChannel({ name, email, verified: true });

  const title = `E2E Article ${Date.now()}`;
  const excerpt = `E2E excerpt ${Date.now()}`;
  const bodyText = `E2E article body ${Date.now()}`;

  try {
    await page.route("https://www.youtube-nocookie.com/**", (route) => route.abort());
    await loginViaUi(page, email);
    await page.goto("/blog");
    await expect(page.getByRole("heading", { name: messages.BlogPage.title, exact: true })).toBeVisible();

    const composer = await openComposer(page, "article");
    await composer.getByPlaceholder("Article title...").fill(title);
    await composer.getByPlaceholder("Short summary (optional)...").fill(excerpt);
    const editor = composer.locator(".tiptap");
    await editor.click();
    const boldButton = composer.getByRole("button", { name: "Bold" });
    await boldButton.click();
    // Stored mark applies to subsequently typed text: wait for the active
    // state so typing cannot race the toggle.
    await expect(boldButton).toHaveClass(/bg-sand/);
    await expect(editor).toBeFocused();
    await editor.pressSequentially(bodyText);

    await composer.getByRole("button", { name: "Embed YouTube video" }).click();
    await composer.getByRole("textbox", { name: "YouTube video URL" }).fill("https://youtu.be/dQw4w9WgXcQ");
    await composer.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(editor.locator("iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");

    await composer.getByRole("switch", { name: "Publish in posts timeline" }).click();
    await composer.getByRole("button", { name: messages.ContentComposer.publish, exact: true }).click();

    await expect(composer).not.toBeVisible();

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
    await expect(page.locator("article iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    await page.getByRole("button", { name: "Edit article" }).first().click();
    await expect(page.getByRole("dialog").locator(".tiptap iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
