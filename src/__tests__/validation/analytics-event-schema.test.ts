import { expect, it } from "vitest";
import { analyticsEventSchema } from "@/lib/validation";
it("accepts only registered resources/events and valid in-memory visit tokens", () => {
  const valid = { resourceType: "blogPost", resourceId: "blog-1", event: "view", visitId: crypto.randomUUID() };
  expect(analyticsEventSchema.safeParse(valid).success).toBe(true);
  for (const override of [{ resourceType: "user" }, { event: "purchase" }, { resourceId: " " }, { visitId: "arbitrary" }]) {
    expect(analyticsEventSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  }
});
