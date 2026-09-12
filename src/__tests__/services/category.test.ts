import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    postCategory: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    blogPostCategory: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import {
  canonicalizeCategoryNames,
  searchCategories,
  getCategoryBySlug,
  getCategoryByName,
  resolveCategoryIds,
  setPostCategories,
  setBlogPostCategories,
} from "@/lib/services/category";

describe("canonicalizeCategoryNames", () => {
  it("title-cases, dedupes, and drops empties", () => {
    expect(canonicalizeCategoryNames(["holy name", "HOLY  NAME", "  ", "Bhakti"])).toEqual([
      "Holy Name",
      "Bhakti",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(canonicalizeCategoryNames([])).toEqual([]);
  });
});

describe("searchCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefix-searches canonical names within one language", async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([{ id: "1", name: "Holy Name", language: "en" }]);
    const result = await searchCategories({ search: "holy", limit: 10, language: "en" });

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { language: "en", name: { startsWith: "Holy" } },
      orderBy: { name: "asc" },
      take: 10,
      select: { id: true, name: true, slug: true, language: true },
    });
    expect(result).toEqual([{ id: "1", name: "Holy Name", language: "en" }]);
  });

  it("hides other languages from the picker scope", async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([]);
    await searchCategories({ limit: 5, language: "cs" });

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { language: "cs" },
      orderBy: { name: "asc" },
      take: 5,
      select: { id: true, name: true, slug: true, language: true },
    });
  });

  it("lists the head of the taxonomy without a search", async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([]);
    await searchCategories({ limit: 5 });

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { name: "asc" },
      take: 5,
      select: { id: true, name: true, slug: true, language: true },
    });
  });
});

describe("getCategoryBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the composite language_slug key", async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: "1",
      name: "Holy Name",
      slug: "holy-name",
      language: "en",
    });

    const result = await getCategoryBySlug("en", "Holy-Name");

    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { language_slug: { language: "en", slug: "holy-name" } },
      select: { id: true, name: true, slug: true, language: true },
    });
    expect(result?.name).toBe("Holy Name");
  });
});

describe("getCategoryByName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes the name before lookup", async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: "1",
      name: "Bhakti",
      slug: "bhakti",
      language: "cs",
    });

    const result = await getCategoryByName("cs", "  bhakti ");

    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { language_name: { language: "cs", name: "Bhakti" } },
      select: { id: true, name: true, slug: true, language: true },
    });
    expect(result?.slug).toBe("bhakti");
  });

  it("returns null for blank input without hitting the database", async () => {
    expect(await getCategoryByName("en", "   ")).toBeNull();
    expect(prisma.category.findUnique).not.toHaveBeenCalled();
  });
});

describe("resolveCategoryIds", () => {  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts each canonical name in the given language", async () => {
    vi.mocked(prisma.category.upsert)
      .mockResolvedValueOnce({ id: "id-1" })
      .mockResolvedValueOnce({ id: "id-2" });

    const ids = await resolveCategoryIds(prisma, ["holy name", "Bhakti"], "en");

    expect(prisma.category.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.category.upsert).toHaveBeenCalledWith({
      where: { language_name: { language: "en", name: "Holy Name" } },
      update: {},
      create: { name: "Holy Name", slug: "holy-name", language: "en" },
      select: { id: true },
    });
    expect(ids).toEqual(["id-1", "id-2"]);
  });

  it("suffixes the slug when distinct names slugify alike", async () => {
    const slugConflict = { code: "P2002", meta: { target: ["language", "slug"] } };
    vi.mocked(prisma.category.upsert)
      .mockRejectedValueOnce(slugConflict)
      .mockResolvedValueOnce({ id: "id-2" });

    const ids = await resolveCategoryIds(prisma, ["Holy-Name"], "en");

    expect(prisma.category.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.category.upsert).toHaveBeenNthCalledWith(1, {
      where: { language_name: { language: "en", name: "Holy-Name" } },
      update: {},
      create: { name: "Holy-Name", slug: "holy-name", language: "en" },
      select: { id: true },
    });
    expect(prisma.category.upsert).toHaveBeenNthCalledWith(2, {
      where: { language_name: { language: "en", name: "Holy-Name" } },
      update: {},
      create: { name: "Holy-Name", slug: "holy-name-2", language: "en" },
      select: { id: true },
    });
    expect(ids).toEqual(["id-2"]);
  });

  it("reads the winner when the name itself races", async () => {
    vi.mocked(prisma.category.upsert).mockRejectedValue({
      code: "P2002",
      meta: { target: ["language", "name"] },
    });
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: "id-winner" });

    const ids = await resolveCategoryIds(prisma, ["Bhakti"], "en");

    expect(ids).toEqual(["id-winner"]);
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { language_name: { language: "en", name: "Bhakti" } },
      select: { id: true },
    });
  });

  it("keeps same-named categories of different languages apart", async () => {
    vi.mocked(prisma.category.upsert)
      .mockResolvedValueOnce({ id: "id-en" })
      .mockResolvedValueOnce({ id: "id-cs" });

    const en = await resolveCategoryIds(prisma, ["Bhakti"], "en");
    const cs = await resolveCategoryIds(prisma, ["Bhakti"], "cs");

    expect(prisma.category.upsert).toHaveBeenNthCalledWith(1, {
      where: { language_name: { language: "en", name: "Bhakti" } },
      update: {},
      create: { name: "Bhakti", slug: "bhakti", language: "en" },
      select: { id: true },
    });
    expect(prisma.category.upsert).toHaveBeenNthCalledWith(2, {
      where: { language_name: { language: "cs", name: "Bhakti" } },
      update: {},
      create: { name: "Bhakti", slug: "bhakti", language: "cs" },
      select: { id: true },
    });
    expect(en).toEqual(["id-en"]);
    expect(cs).toEqual(["id-cs"]);
  });

  it("converges duplicates to one upsert", async () => {
    vi.mocked(prisma.category.upsert).mockResolvedValue({ id: "id-1" });
    const ids = await resolveCategoryIds(prisma, ["bhakti", "Bhakti"], "en");

    expect(prisma.category.upsert).toHaveBeenCalledTimes(1);
    expect(ids).toEqual(["id-1"]);
  });

  it("skips the database for empty input", async () => {
    expect(await resolveCategoryIds(prisma, [], "en")).toEqual([]);
    expect(prisma.category.upsert).not.toHaveBeenCalled();
  });
});

describe("setPostCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces links via delete-all plus create-many", async () => {
    await setPostCategories(prisma, "post-1", ["c1", "c2"]);

    expect(prisma.postCategory.deleteMany).toHaveBeenCalledWith({ where: { postId: "post-1" } });
    expect(prisma.postCategory.createMany).toHaveBeenCalledWith({
      data: [
        { postId: "post-1", categoryId: "c1" },
        { postId: "post-1", categoryId: "c2" },
      ],
      skipDuplicates: true,
    });
  });

  it("clears links without inserting", async () => {
    await setPostCategories(prisma, "post-1", []);

    expect(prisma.postCategory.deleteMany).toHaveBeenCalledWith({ where: { postId: "post-1" } });
    expect(prisma.postCategory.createMany).not.toHaveBeenCalled();
  });
});

describe("setBlogPostCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces links via delete-all plus create-many", async () => {
    await setBlogPostCategories(prisma, "blog-1", ["c1"]);

    expect(prisma.blogPostCategory.deleteMany).toHaveBeenCalledWith({ where: { blogPostId: "blog-1" } });
    expect(prisma.blogPostCategory.createMany).toHaveBeenCalledWith({
      data: [{ blogPostId: "blog-1", categoryId: "c1" }],
      skipDuplicates: true,
    });
  });

  it("clears links without inserting", async () => {
    await setBlogPostCategories(prisma, "blog-1", []);

    expect(prisma.blogPostCategory.deleteMany).toHaveBeenCalledWith({ where: { blogPostId: "blog-1" } });
    expect(prisma.blogPostCategory.createMany).not.toHaveBeenCalled();
  });
});
