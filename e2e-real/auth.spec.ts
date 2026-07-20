import { expect, test, type Page } from "@playwright/test";
import { cleanupUsersByEmail, createUserWithPersonalChannel, loginViaUi, uniqueE2EEmail, TEST_PASSWORD } from "./helpers";

async function openRegisterForm(page: Page) {
  for (const path of ["/register", "/en/register", "/register"]) {
    await page.goto(path);
    const nameInput = page.getByPlaceholder("Your name");
    try {
      await expect(nameInput).toBeVisible({ timeout: 10_000 });
      return nameInput;
    } catch {
      // Try the alternate canonical/prefixed auth route; Next dev can return
      // a transient 404 for the first middleware-rewritten auth request.
    }
  }

  throw new Error("Register form was not reachable");
}

test("user can register", async ({ page }) => {
  const email = uniqueE2EEmail("register");
  const name = `E2E Register ${Date.now()}`;

  await cleanupUsersByEmail([email]);

  try {
    await (await openRegisterForm(page)).fill(name);
    await page.getByPlaceholder("your@email.com").fill(email);
    await page.getByPlaceholder("At least 6 characters").fill(TEST_PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create Account" }).click();

    await page.waitForURL("**/login?registered=true");
    await expect(page.getByText("Account created successfully")).toBeVisible();
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});

test("user can sign in", async ({ page }) => {
  const email = uniqueE2EEmail("login");
  const name = `E2E Login ${Date.now()}`;

  await createUserWithPersonalChannel({ name, email });

  try {
    await loginViaUi(page, email, TEST_PASSWORD);
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
