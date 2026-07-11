import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    channel: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    channelSlugHistory: {
      create: vi.fn(),
      findFirst: vi.fn(),
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
  password: "hashed-pw",
  image: null,
  createdAt: new Date("2026-01-01"),
  channels: [{ id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1", _count: { posts: 5 } }],
};

describe("GET /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user profile with email and channel for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser);

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Devotee");
    expect(json.email).toBe("devotee@example.com");
    expect(json.channels).toHaveLength(1);
    expect(json.channels[0]).toMatchObject({ id: "channel-1", name: "Devotee", slug: "devotee", ownerId: "user-1" });
    expect(json.channels[0].postCount).toBe(5);
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

  it("returns user profile without email for non-owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "other-user" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      email: undefined as unknown as string, // email is excluded in the select when not owner
    });

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Devotee");
    expect(json.email).toBeUndefined();
    expect(json.channels).toHaveLength(1);
    expect(json.channels[0].id).toBe("channel-1");
  });
});

describe("PATCH /api/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates own name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce({ id: "channel-1", name: "Devotee", slug: "devotee", ownerId: "user-1", isPersonal: true } as any)
      .mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.create).mockResolvedValue({} as any);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: "user-1", name: "New Name", email: "devotee@example.com", image: null, createdAt: new Date("2026-01-01") } as any);
    vi.mocked(prisma.channel.update).mockResolvedValue({ id: "channel-1", name: "New Name", slug: "new-name" } as any);

    const res = await PATCH(mockRequest({ name: "New Name" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("New Name");
    expect(prisma.channel.findFirst).toHaveBeenCalledWith({
      where: { ownerId: "user-1", isPersonal: true },
      select: { id: true, name: true, slug: true },
    });
  });

  it("returns 403 when not the owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "other-user" } } as any);

    const res = await PATCH(mockRequest({ name: "Hacker" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 403 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

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
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 3_600_000 } as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await PATCH(mockRequest({ name: "New" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
    expect(warnSpy).toHaveBeenCalledWith("rate_limited", { route: "update-profile", userId: "user-1" });
    warnSpy.mockRestore();
  });

  it("returns 409 when channel name is taken (including diacritic variants)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce({ id: "channel-1", name: "Devotee", slug: "devotee", ownerId: "user-1", isPersonal: true } as any)
      .mockResolvedValueOnce({ id: "taken" } as any);

    const res = await PATCH(mockRequest({ name: "Taken Name" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("returns 409 when new name matches the brand name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await PATCH(mockRequest({ name: "Sincere Bhakti" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("allows brand name when caller is the SINCERE_BHAKTI_EMAIL owner", async () => {
    const prev = process.env.SINCERE_BHAKTI_EMAIL;
    try {
      process.env.SINCERE_BHAKTI_EMAIL = "devotee@example.com";
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", email: "devotee@example.com" } } as any);
      vi.mocked(prisma.channel.findFirst)
        .mockResolvedValueOnce({ id: "channel-1", name: "Devotee", slug: "devotee", ownerId: "user-1", isPersonal: true } as any)
        .mockResolvedValue(null);
      vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channelSlugHistory.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ id: "user-1", name: "Sincere Bhakti", email: "devotee@example.com", image: null, createdAt: new Date("2026-01-01") } as any);
      vi.mocked(prisma.channel.update).mockResolvedValue({ id: "channel-1", name: "Sincere Bhakti", slug: "sincere-bhakti" } as any);

      const res = await PATCH(mockRequest({ name: "Sincere Bhakti" }), { params: Promise.resolve({ id: "user-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.name).toBe("Sincere Bhakti");
    } finally {
      process.env.SINCERE_BHAKTI_EMAIL = prev;
    }
  });

  it("returns 500 on server error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce({ id: "channel-1", name: "Devotee", slug: "devotee", ownerId: "user-1", isPersonal: true } as any)
      .mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("DB down"));

    const res = await PATCH(mockRequest({ name: "New" }), { params: Promise.resolve({ id: "user-1" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });
});
