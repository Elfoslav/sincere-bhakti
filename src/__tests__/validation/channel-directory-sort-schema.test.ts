import { expect, it } from "vitest";
import { channelDirectorySortSchema } from "@/lib/validation";
it("accepts only supported channel sorts", () => {
  expect(channelDirectorySortSchema.safeParse("active").success).toBe(true);
  expect(channelDirectorySortSchema.safeParse("newest").success).toBe(true);
  expect(channelDirectorySortSchema.safeParse("injected").success).toBe(false);
});
