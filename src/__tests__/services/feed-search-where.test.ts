import { describe, it, expect } from "vitest";
import { andWhere, buildFeedSearchWhere } from "@/lib/services/feed-scope";
import { FEED_SEARCH_MAX_TERMS } from "@/lib/validation";

const fields = (term: string) => [{ content: { contains: term, mode: "insensitive" as const } }];

describe("buildFeedSearchWhere", () => {
  it("returns undefined for a missing or blank query", () => {
    expect(buildFeedSearchWhere(undefined, fields)).toBeUndefined();
    expect(buildFeedSearchWhere("   ", fields)).toBeUndefined();
  });

  it("requires every term to match one of the fields", () => {
    expect(buildFeedSearchWhere("holy  name", fields)).toEqual({
      AND: [
        { OR: [{ content: { contains: "holy", mode: "insensitive" } }] },
        { OR: [{ content: { contains: "name", mode: "insensitive" } }] },
      ],
    });
  });

  it("caps the number of terms", () => {
    const query = Array.from({ length: FEED_SEARCH_MAX_TERMS + 3 }, (_, i) => `t${i}`).join(" ");
    const where = buildFeedSearchWhere(query, fields);
    expect(where?.AND).toHaveLength(FEED_SEARCH_MAX_TERMS);
  });
});

describe("andWhere", () => {
  it("creates AND when absent", () => {
    const where: { AND?: unknown } = {};
    andWhere(where, { a: 1 });
    expect(where.AND).toEqual([{ a: 1 }]);
  });

  it("appends to an existing AND array without dropping it", () => {
    const where: { AND?: unknown } = { AND: [{ scope: true }] };
    andWhere(where, { a: 1 }, undefined, { b: 2 });
    expect(where.AND).toEqual([{ scope: true }, { a: 1 }, { b: 2 }]);
  });

  it("wraps a single existing AND object", () => {
    const where: { AND?: unknown } = { AND: { scope: true } };
    andWhere(where, { a: 1 });
    expect(where.AND).toEqual([{ scope: true }, { a: 1 }]);
  });

  it("leaves the clause untouched when nothing is added", () => {
    const where: { AND?: unknown } = {};
    andWhere(where, undefined);
    expect(where.AND).toBeUndefined();
  });
});
