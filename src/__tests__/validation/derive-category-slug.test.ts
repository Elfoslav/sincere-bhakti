import { describe, it, expect } from "vitest";
import { deriveCategorySlug } from "@/lib/validation";

describe("deriveCategorySlug", () => {
  it("derives lowercase dashed slugs from canonical names", () => {
    expect(deriveCategorySlug("Holy Name")).toBe("holy-name");
    expect(deriveCategorySlug("Bhakti")).toBe("bhakti");
  });

  it("folds diacritics like post slugs", () => {
    expect(deriveCategorySlug("Kršna")).toBe("krsna");
  });

  it("folds the full Slovak/Czech diacritic set instead of omitting chars", () => {
    // Guards the invariant the category slug backfill relies on: every one
    // of these must fold to a letter, never vanish (which produced slugs
    // like "ekad-i" for "Ekadáši").
    expect(deriveCategorySlug("ĽŠČŤŽÝÁÍÉÔÄŇ")).toBe("lsctzyaieoan");
    expect(deriveCategorySlug("Úpřimnost")).toBe("uprimnost");
    expect(deriveCategorySlug("Ekadáši")).toBe("ekadasi");
  });

  it("collapses punctuation runs to single dashes", () => {
    expect(deriveCategorySlug("Holy-Name")).toBe("holy-name");
    expect(deriveCategorySlug("Q&A")).toBe("q-a");
  });

  it("falls back to category when nothing slug-able remains", () => {
    expect(deriveCategorySlug("!!!")).toBe("category");
    expect(deriveCategorySlug("")).toBe("category");
  });
});
