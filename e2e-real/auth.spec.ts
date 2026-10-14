import { expect, test, type Page } from "@playwright/test";
import { cleanupUsersByEmail, createUserWithPersonalChannel, loginViaUi, uniqueE2EEmail, TEST_PASSWORD } from "./helpers";
import messages from "../messages/en.json";
import { PASSWORD_MIN_LENGTH } from "../src/lib/validation";

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
    await page.getByPlaceholder(messages.Auth.register.passwordPlaceholder.replace("{min}", String(PASSWORD_MIN_LENGTH))).fill(TEST_PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: messages.Auth.register.button }).click();

    await page.waitForURL("**/login?registered=true");
    await expect(page.getByText(messages.Auth.login.registeredVerify)).toBeVisible();
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
