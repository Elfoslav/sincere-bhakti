import { describe, expect, it } from "vitest";
import { createTranslator, type AbstractIntlMessages } from "next-intl";
import en from "../../messages/en.json";
import cs from "../../messages/cs.json";
import sk from "../../messages/sk.json";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

const catalogs = { en, cs, sk };

function flattenMessages(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      Object.entries(flattenMessages(child, prefix ? `${prefix}.${key}` : key)),
    ),
  );
}

describe("message catalogs", () => {
  const source = flattenMessages(en);

  for (const [locale, messages] of Object.entries(catalogs)) {
    const t = createTranslator({
      locale,
      messages: messages as unknown as AbstractIntlMessages,
      onError: (error) => { throw error; },
    });

    it(`${locale} has matching keys, interpolation variables and rich-text tags`, () => {
      const translated = flattenMessages(messages);
      expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
      for (const [key, value] of Object.entries(translated)) {
        expect(value.trim(), key).not.toBe("");
        const variables = (text: string) => [...text.matchAll(/\{(\w+)(?=[},])/g)].map((match) => match[1]).sort();
        const tags = (text: string) => [...text.matchAll(/<\/?\w+>/g)].map((match) => match[0]).sort();
        expect(variables(value), key).toEqual(variables(source[key]));
        expect(tags(value), key).toEqual(tags(source[key]));
      }
    });

    it(`${locale} formats both password hints using the validation minimum`, () => {
      for (const namespace of ["register", "resetPassword"]) {
        const key = `Auth.${namespace}.passwordPlaceholder`;
        expect(t(key, { min: PASSWORD_MIN_LENGTH })).toContain(String(PASSWORD_MIN_LENGTH));
        expect(t(key, { min: PASSWORD_MIN_LENGTH + 1 })).toContain(String(PASSWORD_MIN_LENGTH + 1));
      }
    });

    const postForms = locale === "en"
      ? ["0 posts", "1 post", "2 posts", "4 posts", "5 posts", "21 posts"]
      : locale === "cs"
        ? ["0 příspěvků", "1 příspěvek", "2 příspěvky", "4 příspěvky", "5 příspěvků", "21 příspěvků"]
        : ["0 príspevkov", "1 príspevok", "2 príspevky", "4 príspevky", "5 príspevkov", "21 príspevkov"];
    const itemForms = locale === "en"
      ? ["0 items", "1 item", "2 items", "4 items", "5 items", "21 items"]
      : locale === "cs"
        ? ["0 položek", "1 položka", "2 položky", "4 položky", "5 položek", "21 položek"]
        : ["0 položiek", "1 položka", "2 položky", "4 položky", "5 položiek", "21 položiek"];

    it.each([0, 1, 2, 4, 5, 21])(`${locale} inflects counts correctly for %i`, (count) => {
      const index = [0, 1, 2, 4, 5, 21].indexOf(count);
      for (const namespace of ["ProfilePage", "ChannelsPage", "ChannelPage"]) {
        expect(t(`${namespace}.postCount`, { count })).toBe(postForms[index]);
      }
      expect(t("Gallery.itemCount", { count })).toBe(itemForms[index]);
    });
  }
});
