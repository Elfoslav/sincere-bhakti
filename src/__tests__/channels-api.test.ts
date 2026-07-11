import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/rate-limit", () => {
  const mockRateLimit = vi.fn(() => ({ allowed: true, remaining: 9, resetIn: 3_600_000 }));
  const RATE_LIMITS = { createChannel: { limit: 10, windowMs: 3_600_000 }, updateChannel: { limit: 10, windowMs: 3_600_000 } };
  return {
    RATE_LIMITS,
    rateLimitKey: (prefix: string, id: string) => `${prefix}:${id}`,
    rateLimit: mockRateLimit,
    __esModule: true,
  };
});

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { POST } from "@/app/api/channels/route";
import { PATCH } from "@/app/api/channels/[slug]/route";

function mockRequest(body?: unknown): any {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

describe("POST /api/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-1", name: "My Devotees", normalizedName: "my devotees", slug: "my-devotees", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
    } as any);

    const res = await POST(mockRequest({ name: "My Devotees" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("My Devotees");
    expect(json.slug).toBe("my-devotees");
    expect(json.ownerId).toBe("user-1");
    expect(json.postCount).toBe(0);
  });

  it("returns 409 when name matches the brand name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest({ name: "Sincere Bhakti" }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("allows brand name when caller is the SINCERE_BHAKTI_EMAIL owner", async () => {
    const prev = process.env.SINCERE_BHAKTI_EMAIL;
    try {
      process.env.SINCERE_BHAKTI_EMAIL = "owner@sincerebhakti.com";
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", email: "owner@sincerebhakti.com" } } as any);
      vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channel.create).mockResolvedValue({
        id: "ch-brand", name: "Sincere Bhakti", normalizedName: "sincere bhakti", slug: "sincere-bhakti", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
      } as any);

      const res = await POST(mockRequest({ name: "Sincere Bhakti" }));
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.name).toBe("Sincere Bhakti");
    } finally {
      process.env.SINCERE_BHAKTI_EMAIL = prev;
    }
  });

  it("creates channel with suffix when normalized name is taken", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue({ id: "existing" } as any);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-2", name: "My Name (2)", normalizedName: "my name (2)", slug: "my-name-2", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
    } as any);

    const res = await POST(mockRequest({ name: "My Name" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("My Name (2)");
  });

  it("returns 400 on invalid name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest({ name: "a" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeTruthy();
  });

  it("returns 403 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await POST(mockRequest({ name: "Channel" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 403 on invalid origin", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    vi.mocked(validateOrigin).mockReturnValueOnce(false);

    const res = await POST(mockRequest({ name: "Channel" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 3_600_000 } as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await POST(mockRequest({ name: "Channel" }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
    expect(warnSpy).toHaveBeenCalledWith("rate_limited", { route: "create-channel", userId: "user-1" });
    warnSpy.mockRestore();
  });

  it("returns 500 on server error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findFirst).mockRejectedValue(new Error("DB down"));

    const res = await POST(mockRequest({ name: "Channel" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });
});

describe("PATCH /api/channels/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = { params: Promise.resolve({ slug: "my-channel" }) };

  it("renames a channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old Name", ownerId: "user-1", isPersonal: false } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.update).mockResolvedValue({
      id: "ch-1", name: "New Name", slug: "my-channel", avatarUrl: null, ownerId: "user-1",
    } as any);

    const res = await PATCH(mockRequest({ name: "New Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("New Name");
    expect(prisma.channel.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ch-1" }, data: { name: "New Name", normalizedName: "new name" } }),
    );
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue(null);

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("returns 403 when not the owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-2" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false } as any);

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 403 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 403 on invalid origin", async () => {
    const { validateOrigin } = await import("@/lib/csrf");
    vi.mocked(validateOrigin).mockReturnValueOnce(false);

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 409 when name matches the brand name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false } as any);

    const res = await PATCH(mockRequest({ name: "Sincere Bhakti" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("returns 400 when trying to rename a personal channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Personal", ownerId: "user-1", isPersonal: true } as any);

    const res = await PATCH(mockRequest({ name: "New Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("cannot_rename_personal_channel");
  });

  it("allows brand name when caller is the SINCERE_BHAKTI_EMAIL owner", async () => {
    const prev = process.env.SINCERE_BHAKTI_EMAIL;
    try {
      process.env.SINCERE_BHAKTI_EMAIL = "owner@sincerebhakti.com";
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", email: "owner@sincerebhakti.com" } } as any);
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false } as any);
      vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channel.update).mockResolvedValue({
        id: "ch-1", name: "Sincere Bhakti", slug: "my-channel", avatarUrl: null, ownerId: "user-1",
      } as any);

      const res = await PATCH(mockRequest({ name: "Sincere Bhakti" }), params);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.name).toBe("Sincere Bhakti");
    } finally {
      process.env.SINCERE_BHAKTI_EMAIL = prev;
    }
  });

  it("returns 409 when normalized name is taken by another channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue({ id: "ch-2" } as any);

    const res = await PATCH(mockRequest({ name: "Existing Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
    expect(prisma.channel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedName: "existing name", id: { not: "ch-1" } } }),
    );
  });

  it("returns 400 on invalid name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false } as any);

    const res = await PATCH(mockRequest({ name: "a" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeTruthy();
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 3_600_000 } as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
    expect(warnSpy).toHaveBeenCalledWith("rate_limited", { route: "update-channel", userId: "user-1" });
    warnSpy.mockRestore();
  });

  it("returns 500 on server error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.update).mockRejectedValue(new Error("DB down"));

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });
});
