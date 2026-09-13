import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/services/category", () => ({
  searchCategories: vi.fn(),
  resolveCategoryIds: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { searchCategories, resolveCategoryIds } from "@/lib/services/category";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/categories/route";

function mockRequest(url: string, body?: unknown) {
  return {
    url,
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

const verifiedUser = { user: { id: "user-1", emailVerifiedAt: "2026-01-01T00:00:00.000Z" } } as any;

describe("GET /api/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching categories in the requested language", async () => {
    vi.mocked(searchCategories).mockResolvedValue([{ id: "1", name: "Holy Name", language: "en" }]);

    const res = await GET(mockRequest("http://localhost:3000/api/categories?search=holy&limit=10&language=en"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.categories).toEqual([{ id: "1", name: "Holy Name", language: "en" }]);
    expect(searchCategories).toHaveBeenCalledWith({ search: "holy", limit: 10, language: "en" });
  });

  it("returns 400 for an invalid limit", async () => {
    const res = await GET(mockRequest("http://localhost:3000/api/categories?limit=999"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("limit");
    expect(searchCategories).not.toHaveBeenCalled();
  });
});

describe("POST /api/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await POST(mockRequest("http://localhost:3000/api/categories", { name: "bhakti" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("returns 403 when the caller's email is not verified", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", emailVerifiedAt: null } } as any);

    const res = await POST(mockRequest("http://localhost:3000/api/categories", { name: "bhakti" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(resolveCategoryIds).not.toHaveBeenCalled();
  });

  it("get-or-creates the canonical category in the requested language", async () => {
    vi.mocked(auth).mockResolvedValue(verifiedUser);
    vi.mocked(resolveCategoryIds).mockResolvedValue(["cat-1"]);
    vi.mocked(prisma.category.findUniqueOrThrow).mockResolvedValue({ id: "cat-1", name: "Bhakti", slug: "bhakti", language: "cs" });

    const res = await POST(mockRequest("http://localhost:3000/api/categories", { name: "  bhakti ", language: "cs" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: "cat-1", name: "Bhakti", slug: "bhakti", language: "cs" });
    // Zod transform canonicalizes before the service ever sees the name.
    expect(resolveCategoryIds).toHaveBeenCalledWith(expect.anything(), ["Bhakti"], "cs");
    expect(prisma.category.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "cat-1" },
      select: { id: true, name: true, slug: true, language: true },
    });
  });

  it("returns 400 for an empty name", async () => {
    vi.mocked(auth).mockResolvedValue(verifiedUser);

    const res = await POST(mockRequest("http://localhost:3000/api/categories", { name: "   " }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("name");
    expect(resolveCategoryIds).not.toHaveBeenCalled();
  });
});
