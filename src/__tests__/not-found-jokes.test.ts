import { describe, it, expect } from "vitest";
import { NOT_FOUND_JOKES, getRandomInt, getRandomJoke } from "@/lib/not-found-jokes";

describe("getRandomInt", () => {
  it("stays within bounds", () => {
    for (let i = 0; i < 50; i++) {
      const value = getRandomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });
});

describe("getRandomJoke", () => {
  it("returns a joke from the list", () => {
    expect(NOT_FOUND_JOKES).toContain(getRandomJoke());
  });
});
