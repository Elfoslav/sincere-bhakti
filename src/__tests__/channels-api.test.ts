import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    channelSlugHistory: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => any) => cb({
      channel: {
        findFirst: (...args: any[]) => (prisma.channel.findFirst as any)(...args),
        create: (...args: any[]) => (prisma.channel.create as any)(...args),
        findUnique: (...args: any[]) => (prisma.channel.findUnique as any)(...args),
        update: (...args: any[]) => (prisma.channel.update as any)(...args),
        updateMany: (...args: any[]) => (prisma.channel.updateMany as any)(...args),
      },
      channelSlugHistory: {
        create: (...args: any[]) => (prisma.channelSlugHistory.create as any)(...args),
        findFirst: (...args: any[]) => (prisma.channelSlugHistory.findFirst as any)(...args),
      },
    })),
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/rate-limit", () => {
  const mockRateLimit = vi.fn((_key: string, _limit: number, _windowMs: number) => ({ allowed: true, remaining: 9, resetIn: 3_600_000 }));
  const RATE_LIMITS = { createChannel: { limit: 20, windowMs: 3_600_000 }, updateChannel: { limit: 20, windowMs: 3_600_000 } };
  const rateLimitKey = (prefix: string, id: string) => `${prefix}:${id}`;
  return {
    RATE_LIMIT_PREFIX: {
      readChannel: "read-channel",
      searchChannels: "search-channels",
      createChannel: "create-channel",
      updateChannel: "update-channel",
    },
    RATE_LIMITS,
    rateLimitKey,
    rateLimit: mockRateLimit,
    getClientIp: (headers: Headers) => headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    checkRateLimit: vi.fn(async (_prefix: string, _id: string, _limit: number, _windowMs: number) => {
      const { allowed } = await mockRateLimit(rateLimitKey(_prefix, _id), _limit, _windowMs);
      if (!allowed) console.warn("rate_limited", { route: _prefix, identifier: _id });
      return allowed;
    }),
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
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
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

  it("returns 409 when normalized name is taken by an active channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue({ id: "existing" } as any);

    const res = await POST(mockRequest({ name: "My Name" }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("returns 400 on invalid name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await POST(mockRequest({ name: "" }));
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
    expect(warnSpy).toHaveBeenCalledWith("rate_limited", { route: "create-channel", identifier: "user-1" });
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

  it("returns 409 when the user reaches the channel creation limit", async () => {
    const previous = process.env.MAX_CHANNELS_PER_USER;
    try {
      process.env.MAX_CHANNELS_PER_USER = "1";
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
      vi.mocked(prisma.channel.count).mockResolvedValue(1);

      const res = await POST(mockRequest({ name: "Another Channel" }));
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toBe("channel_limit_reached");
    } finally {
      process.env.MAX_CHANNELS_PER_USER = previous;
    }
  });
});

describe("PATCH /api/channels/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = { params: Promise.resolve({ slug: "my-channel" }) };

  it("renames a channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old Name", ownerId: "user-1", isPersonal: false, slug: "old-name", renameCount: 0 } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({ id: "ch-1", name: "Old Name", ownerId: "user-1", isPersonal: false, slug: "old-name", avatarUrl: null, renameCount: 0 } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
      id: "ch-1", name: "New Name", slug: "new-name", avatarUrl: null, ownerId: "user-1", renameCount: 1,
    } as any);
    vi.mocked(prisma.channelSlugHistory.create).mockResolvedValue({} as any);

    const res = await PATCH(mockRequest({ name: "New Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("New Name");
    expect(json.slug).toBe("new-name");
    expect(prisma.channel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ch-1", ownerId: "user-1", renameCount: { lt: 3 } }, data: { name: "New Name", normalizedName: "new name", slug: "new-name", renameCount: { increment: 1 } } }),
    );
    expect(prisma.channelSlugHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { oldSlug: "old-name", oldNormalizedName: "old name", channelId: "ch-1" } }),
    );
  });

  it("returns 200 without incrementing count when renaming to the same name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old Name", ownerId: "user-1", isPersonal: false, slug: "old-name", avatarUrl: "https://example.com/avatar.png", renameCount: 2 } as any);

    const res = await PATCH(mockRequest({ name: "Old Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Old Name");
    expect(json.slug).toBe("old-name");
    expect(json.avatarUrl).toBe("https://example.com/avatar.png");
    expect(json.renameCount).toBe(2);
    expect(prisma.channel.update).not.toHaveBeenCalled();
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the rename cap is reached during the write", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old Name", ownerId: "user-1", isPersonal: false, slug: "old-name", avatarUrl: null, renameCount: 2 } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await PATCH(mockRequest({ name: "New Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("rename_limit_reached");
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
  });

  it("returns 200 without incrementing count when name differs only by case", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old Name", ownerId: "user-1", isPersonal: false, slug: "old-name", renameCount: 1 } as any);

    const res = await PATCH(mockRequest({ name: "old name" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Old Name");
    expect(json.renameCount).toBe(1);
    expect(prisma.channel.update).not.toHaveBeenCalled();
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
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
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false, slug: "my-channel" } as any);

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
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false, slug: "my-channel" } as any);

    const res = await PATCH(mockRequest({ name: "Sincere Bhakti" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("returns 400 when trying to rename a personal channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Personal", ownerId: "user-1", isPersonal: true, slug: "personal-channel" } as any);

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
      vi.mocked(prisma.channel.findUnique)
        .mockResolvedValueOnce({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false, slug: "my-channel", avatarUrl: null, renameCount: 0 } as any)
        .mockResolvedValueOnce({ id: "ch-1", name: "Sincere Bhakti", slug: "sincere-bhakti", avatarUrl: null, ownerId: "user-1", renameCount: 1 } as any);
      vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channelSlugHistory.create).mockResolvedValue({} as any);
      vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 1 } as any);

      const res = await PATCH(mockRequest({ name: "Sincere Bhakti" }), params);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.name).toBe("Sincere Bhakti");
      expect(json.slug).toBe("sincere-bhakti");
    } finally {
      process.env.SINCERE_BHAKTI_EMAIL = prev;
    }
  });

  it("returns 409 when normalized name is taken by another channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false, slug: "my-channel" } as any);
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
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false, slug: "my-channel" } as any);

    const res = await PATCH(mockRequest({ name: "" }), params);
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
    expect(warnSpy).toHaveBeenCalledWith("rate_limited", { route: "update-channel", identifier: "user-1" });
    warnSpy.mockRestore();
  });

  it("returns 500 on server error", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ id: "ch-1", name: "Old", ownerId: "user-1", isPersonal: false, slug: "my-channel", avatarUrl: null, renameCount: 0 } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockRejectedValue(new Error("DB down"));

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });

  it("skips history create when oldSlug already exists in channelSlugHistory (A→B→A→C cycle)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channel.findUnique)
      .mockResolvedValueOnce({ id: "ch-1", name: "A", ownerId: "user-1", isPersonal: false, slug: "a", avatarUrl: null, renameCount: 1 } as any)
      .mockResolvedValueOnce({ id: "ch-1", name: "Ca", slug: "ca", avatarUrl: null, ownerId: "user-1", renameCount: 2 } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    // channelSlugHistory.findFirst call order:
    //   1. isNormalizedNameTaken → oldNormalizedName for "Ca" → null (not in history)
    //   2. slug collision check → oldSlug "ca" → null (not in other history)
    //   3. oldInHistory check → oldSlug "a" → found (already in this channel's history)
    vi.mocked(prisma.channelSlugHistory.findFirst)
      .mockResolvedValueOnce(null)                    // call 1
      .mockResolvedValueOnce(null)                    // call 2
      .mockResolvedValueOnce({ id: "hist-1" } as any); // call 3
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 1 } as any);

    const res = await PATCH(mockRequest({ name: "Ca" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.slug).toBe("ca");
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
  });
});
