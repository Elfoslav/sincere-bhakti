import { expect, test } from "@playwright/test";
import { createTranslator } from "next-intl";
import en from "../messages/en.json";
import cs from "../messages/cs.json";
import sk from "../messages/sk.json";
import { PASSWORD_MIN_LENGTH } from "../src/lib/validation";

for (const [locale, messages] of Object.entries({ en, cs, sk })) {
  for (const route of ["register", "reset-password"]) {
    test(`${locale} ${route} shows the enforced password minimum`, async ({ page }) => {
      const namespace = route === "register" ? "register" : "resetPassword";
      const t = createTranslator({ locale, messages: messages.Auth[namespace] });
      await page.goto(`/${locale}/${route}${route === "reset-password" ? "?token=preview" : ""}`);
      const password = page.getByPlaceholder(t("passwordPlaceholder", { min: PASSWORD_MIN_LENGTH }));
      await expect(password).toBeVisible();
      await expect(password).toHaveAttribute("minlength", String(PASSWORD_MIN_LENGTH));
    });
  }
}
