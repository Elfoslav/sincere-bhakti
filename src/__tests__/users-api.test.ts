import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { GET, PATCH } from "@/app/api/users/[id]/route";

function mockRequest(body?: unknown): any {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

const baseUser = {
  id: "user-1",
  name: "Devotee",
  email: "devotee@example.com",
  image: null,
  createdAt: new Date("2026-01-01"),
};

describe("GET /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user profile with email for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Devotee");
    expect(json.email).toBe("devotee@example.com");
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "missing" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("returns 500 on database error", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB down"));

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });
});

describe("PATCH /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates own name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...baseUser,
      name: "New Name",
    });

    const res = await PATCH(mockRequest({ name: "New Name" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("New Name");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { name: "New Name" },
      }),
    );
  });

  it("returns 403 when not the owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "other-user" } } as any);

    const res = await PATCH(mockRequest({ name: "Hacker" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 403 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await PATCH(mockRequest({ name: "New" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 400 on invalid name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await PATCH(mockRequest({ name: "" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeTruthy();
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 3_600_000 });

    const res = await PATCH(mockRequest({ name: "New" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
  });

  it("returns 500 on server error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("DB down"));

    const res = await PATCH(mockRequest({ name: "New" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });
});
