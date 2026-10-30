import { randomBytes } from "node:crypto";
import { test as base } from "@playwright/test";

/** Each scenario is a separate visitor; reruns must not inherit another test's IP quota. */
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provideHeaders) => {
    const address = `fd00:${randomBytes(14).toString("hex").match(/.{4}/g)!.join(":")}`;
    await provideHeaders({ ...extraHTTPHeaders, "X-Forwarded-For": address });
  },
});

export { expect, type Page } from "@playwright/test";
