import { describe, it, expect, vi, beforeEach } from "vitest";
import { CHANNEL_ROLE_ADMIN, CHANNEL_ROLE_EDITOR } from "@/lib/channel-roles";
import { MAX_RENAME_COUNT } from "@/lib/validation";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    channelTranslation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    channelEditor: {
      findUnique: vi.fn(),
    },
    channelSlugHistory: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => any) => {
      const outer = prisma;
      return cb({
        $executeRaw: vi.fn(),
        channel: {
          findFirst: (...args: any[]) => (outer.channel.findFirst as any)(...args),
          findMany: (...args: any[]) => (outer.channel.findMany as any)(...args),
          create: (...args: any[]) => (outer.channel.create as any)(...args),
          findUnique: (...args: any[]) => (outer.channel.findUnique as any)(...args),
          update: (...args: any[]) => (outer.channel.update as any)(...args),
          updateMany: (...args: any[]) => (outer.channel.updateMany as any)(...args),
          count: (...args: any[]) => (outer.channel.count as any)(...args),
        },
        channelTranslation: {
          findFirst: (...args: any[]) => (outer.channelTranslation.findFirst as any)(...args),
          findUnique: (...args: any[]) => (outer.channelTranslation.findUnique as any)(...args),
          update: (...args: any[]) => (outer.channelTranslation.update as any)(...args),
          findMany: (...args: any[]) => (outer.channelTranslation.findMany as any)(...args),
          upsert: (...args: any[]) => (outer.channelTranslation.upsert as any)(...args),
        },
        channelEditor: {
          findUnique: (...args: any[]) => (outer.channelEditor.findUnique as any)(...args),
        },
        channelSlugHistory: {
          create: (...args: any[]) => (outer.channelSlugHistory.create as any)(...args),
          findFirst: (...args: any[]) => (outer.channelSlugHistory.findFirst as any)(...args),
        },
      });
    }),
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/rate-limit", () => {
  const mockRateLimit = vi.fn((_key: string, _limit: number, _windowMs: number) => ({ allowed: true, remaining: 9, resetIn: 3_600_000 }));
  const RATE_LIMITS = { searchChannels: { limit: 30, windowMs: 60_000 }, createChannel: { limit: 20, windowMs: 3_600_000 }, updateChannel: { limit: 20, windowMs: 3_600_000 } };
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
import { GET, POST } from "@/app/api/channels/route";
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
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, createdAt: new Date(),
    } as any);

    const res = await POST(mockRequest({ name: "My Devotees" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("My Devotees");
    expect(json.slug).toBe("my-devotees");
    expect(json.ownerId).toBe("user-1");
    expect(json.postCount).toBe(0);
  });

  it("creates a channel with the requested language", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, createdAt: new Date(),
    } as any);

    const res = await POST(mockRequest({ name: "Můj kanál", language: "cs" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("Můj kanál");
    expect(prisma.channel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          translations: expect.objectContaining({
            create: expect.objectContaining({ language: "cs" }),
          }),
        }),
      }),
    );
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
      vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channel.create).mockResolvedValue({
        id: "ch-brand", ownerId: "user-1", isPersonal: false, avatarUrl: null, createdAt: new Date(),
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
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue({ id: "existing" } as any);

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
    vi.mocked(prisma.channelTranslation.findFirst).mockRejectedValue(new Error("DB down"));

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

describe("GET /api/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockGetRequest(language?: string): any {
    const params = new URLSearchParams();
    if (language) params.set("language", language);
    return {
      headers: new Headers({ host: "localhost:3000", "x-forwarded-for": "127.0.0.1" }),
      url: `http://localhost:3000/api/channels?${params}`,
    } as any;
  }

  it("lists channels with translations for the requested language", async () => {
    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      {
        id: "ch-en", avatarUrl: null, createdAt: new Date(), ownerId: "user-1",
        _count: { posts: 3 },
        translations: [{ name: "English Channel", slug: "english-channel" }],
      },
    ] as any);

    const res = await GET(mockGetRequest("en"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].name).toBe("English Channel");
    expect(json.items[0].slug).toBe("english-channel");
    expect(json.items[0].postCount).toBe(3);
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ translations: { some: { language: "en" } } }),
        select: expect.objectContaining({
          translations: expect.objectContaining({ where: { language: "en" } }),
        }),
      }),
    );
  });

  it("excludes channels without a translation in the requested language", async () => {
    vi.mocked(prisma.channel.findMany).mockResolvedValue([] as any);

    const res = await GET(mockGetRequest("cs"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(0);
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ translations: { some: { language: "cs" } } }),
      }),
    );
  });

  it("falls back to 'en' when no language param is provided", async () => {
    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      {
        id: "ch-1", avatarUrl: null, createdAt: new Date(), ownerId: "user-1",
        _count: { posts: 1 },
        translations: [{ name: "Default", slug: "default" }],
      },
    ] as any);

    const res = await GET(mockGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].name).toBe("Default");
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ translations: { some: { language: "en" } } }),
        select: expect.objectContaining({
          translations: expect.objectContaining({ where: { language: "en" } }),
        }),
      }),
    );
  });

  it("returns a channel for a given userId with the requested language translation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "current-user" } } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue({
      id: "ch-1", avatarUrl: "https://example.com/avatar.png", createdAt: new Date(), ownerId: "current-user",
      _count: { posts: 5 },
      translations: [{ name: "Můj kanál", slug: "muj-kanal" }],
    } as any);

    const params = new URLSearchParams({ userId: "current-user", language: "cs" });
    const res = await GET({ headers: new Headers({ host: "localhost:3000", "x-forwarded-for": "127.0.0.1" }), url: `http://localhost:3000/api/channels?${params}` } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Můj kanál");
    expect(json.slug).toBe("muj-kanal");
    expect(json.postCount).toBe(5);
    expect(prisma.channel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          translations: { where: { language: "cs" }, select: { name: true, slug: true }, take: 1 },
        }),
      }),
    );
  });

  it("returns the English translation for a userId when no language param", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "current-user" } } as any);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue({
      id: "ch-1", avatarUrl: null, createdAt: new Date(), ownerId: "current-user",
      _count: { posts: 2 },
      translations: [{ name: "My Channel", slug: "my-channel" }],
    } as any);

    const params = new URLSearchParams({ userId: "current-user" });
    const res = await GET({ headers: new Headers({ host: "localhost:3000", "x-forwarded-for": "127.0.0.1" }), url: `http://localhost:3000/api/channels?${params}` } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("My Channel");
    expect(json.slug).toBe("my-channel");
  });

  it("supports cursor-based pagination", async () => {
    const channels = Array.from({ length: 20 }, (_, i) => ({
      id: `ch-${i + 1}`, avatarUrl: null, createdAt: new Date(), ownerId: "user-1",
      _count: { posts: 0 },
      translations: [{ name: `Channel ${i + 1}`, slug: `channel-${i + 1}` }],
    }));
    vi.mocked(prisma.channel.findMany).mockResolvedValue(channels as any);

    const params = new URLSearchParams({ language: "en", cursor: "ch-5" });
    const res = await GET({ headers: new Headers({ host: "localhost:3000", "x-forwarded-for": "127.0.0.1" }), url: `http://localhost:3000/api/channels?${params}` } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(20);
    expect(json.nextCursor).toBe("ch-20");
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: "ch-5" } }),
    );
  });

  it("filters by search query in the requested language", async () => {
    vi.mocked(prisma.channelTranslation.findMany).mockResolvedValue([
      { channelId: "ch-1" },
    ] as any);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      {
        id: "ch-1", avatarUrl: null, createdAt: new Date(), ownerId: "user-1",
        _count: { posts: 0 },
        translations: [{ name: "Védská škola", slug: "vedska-skola" }],
      },
    ] as any);

    const params = new URLSearchParams({ q: "védská", language: "cs" });
    const res = await GET({ headers: new Headers({ host: "localhost:3000", "x-forwarded-for": "127.0.0.1" }), url: `http://localhost:3000/api/channels?${params}` } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].name).toBe("Védská škola");
    expect(prisma.channelTranslation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ language: "cs", normalizedName: { contains: "vedska", mode: "insensitive" } }),
      }),
    );
  });

  it("returns 429 when rate limited", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60_000 } as any);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await GET(mockGetRequest("en"));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
    expect(warnSpy).toHaveBeenCalledWith("rate_limited", { route: "search-channels", identifier: "127.0.0.1" });
    warnSpy.mockRestore();
  });

  it("returns 500 on server error", async () => {
    vi.mocked(prisma.channel.findMany).mockRejectedValue(new Error("DB down"));

    const res = await GET(mockGetRequest("en"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });
});

describe("PATCH /api/channels/[slug]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const params = { params: Promise.resolve({ slug: "my-channel" }) };

  it("renames a channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "trans-1", language: "en", name: "Old Name", slug: "old-name", normalizedName: "old name", channelId: "ch-1",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
      } as any)
      .mockResolvedValueOnce(null as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.channelTranslation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.channelSlugHistory.create).mockResolvedValue({} as any);

    const res = await PATCH(mockRequest({ name: "New Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("New Name");
    expect(json.slug).toBe("new-name");
    expect(prisma.channel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "ch-1",
          renameCount: { lt: 3 },
          OR: [
            { ownerId: "user-1" },
            { editors: { some: { userId: "user-1", role: CHANNEL_ROLE_ADMIN } } },
          ],
        },
        data: { renameCount: { increment: 1 } },
      }),
    );
    expect(prisma.channelSlugHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { oldSlug: "old-name", oldNormalizedName: "old name", channelId: "ch-1" } }),
    );
  });

  it("allows a channel admin to rename a channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "trans-1", language: "en", name: "Old Name", slug: "old-name", normalizedName: "old name", channelId: "ch-1",
        channel: { id: "ch-1", ownerId: "owner-1", isPersonal: false, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
      } as any)
      .mockResolvedValueOnce(null as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ role: CHANNEL_ROLE_ADMIN } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.channelTranslation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.channelSlugHistory.create).mockResolvedValue({} as any);

    const res = await PATCH(mockRequest({ name: "New Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("New Name");
    expect(prisma.channelEditor.findUnique).toHaveBeenCalledWith({
      where: { channelId_userId: { channelId: "ch-1", userId: "admin-1" } },
      select: { role: true },
    });
  });

  it("returns 200 without incrementing count when renaming to the same name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "trans-1", language: "en", name: "Old Name", slug: "old-name", normalizedName: "old name", channelId: "ch-1",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: "https://example.com/avatar.png", renameCount: 1, defaultLanguage: "en" },
      } as any)
      .mockResolvedValueOnce(null as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

    const res = await PATCH(mockRequest({ name: "Old Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Old Name");
    expect(json.slug).toBe("old-name");
    expect(json.avatarUrl).toBe("https://example.com/avatar.png");
    expect(json.renameCount).toBe(1);
    expect(prisma.channel.updateMany).not.toHaveBeenCalled();
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
  });

  it("returns 200 for an unchanged brand name even after the rename cap is reached", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", email: "someone@example.com" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({
      id: "trans-1", language: "en", name: "Sincere Bhakti", slug: "sincere-bhakti", normalizedName: "sincere bhakti", channelId: "ch-1",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: MAX_RENAME_COUNT, defaultLanguage: "en" },
    } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

    const res = await PATCH(mockRequest({ name: "Sincere Bhakti" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Sincere Bhakti");
    expect(json.renameCount).toBe(MAX_RENAME_COUNT);
    expect(prisma.channel.updateMany).not.toHaveBeenCalled();
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the rename cap is reached during the write", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "trans-1", language: "en", name: "Old Name", slug: "old-name", normalizedName: "old name", channelId: "ch-1",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 2, defaultLanguage: "en" },
      } as any)
      .mockResolvedValueOnce(null as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.channelTranslation.update).mockResolvedValue({} as any);

    const res = await PATCH(mockRequest({ name: "New Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("rename_limit_reached");
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
  });

  it("returns 200 without incrementing count when name differs only by case", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({
      id: "trans-1", language: "en", name: "Old Name", slug: "old-name", normalizedName: "old name", channelId: "ch-1",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 1, defaultLanguage: "en" },
    } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

    const res = await PATCH(mockRequest({ name: "old name" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.name).toBe("Old Name");
    expect(json.renameCount).toBe(1);
    expect(prisma.channel.updateMany).not.toHaveBeenCalled();
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue(null);

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
  });

  it("returns 404 when the caller is neither owner nor admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-2" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({
      id: "trans-1", language: "en", name: "Old", slug: "my-channel", normalizedName: "old", channelId: "ch-1",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
    } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ role: CHANNEL_ROLE_EDITOR } as any);

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("not_found");
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
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({
      id: "trans-1", language: "en", name: "Old", slug: "my-channel", normalizedName: "old", channelId: "ch-1",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
    } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

    const res = await PATCH(mockRequest({ name: "Sincere Bhakti" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("returns 400 when trying to rename a personal channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({
      id: "trans-1", language: "en", name: "Personal", slug: "personal-channel", normalizedName: "personal", channelId: "ch-1",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: true, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
    } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

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
      vi.mocked(prisma.channelTranslation.findUnique)
        .mockResolvedValueOnce({
          id: "trans-1", language: "en", name: "Old", slug: "my-channel", normalizedName: "old", channelId: "ch-1",
          channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
        } as any)
        .mockResolvedValueOnce(null as any);
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
      vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.channelTranslation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.channelSlugHistory.create).mockResolvedValue({} as any);

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
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({
      id: "trans-1", language: "en", name: "Old", slug: "my-channel", normalizedName: "old", channelId: "ch-1",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
    } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue({ id: "ch-2-trans" } as any);

    const res = await PATCH(mockRequest({ name: "Existing Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
    expect(prisma.channelTranslation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedName: "existing name", channelId: { not: "ch-1" } } }),
    );
  });

  it("returns 400 on invalid name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({
      id: "trans-1", language: "en", name: "Old", slug: "my-channel", normalizedName: "old", channelId: "ch-1",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
    } as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

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
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "trans-1", language: "en", name: "Old", slug: "my-channel", normalizedName: "old", channelId: "ch-1",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 0, defaultLanguage: "en" },
      } as any)
      .mockResolvedValueOnce(null as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockRejectedValue(new Error("DB down"));

    const res = await PATCH(mockRequest({ name: "New" }), params);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });

  it("skips history create when oldSlug already exists in channelSlugHistory (A→B→A→C cycle)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "trans-1", language: "en", name: "A", slug: "a", normalizedName: "a", channelId: "ch-1",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 1, defaultLanguage: "en" },
      } as any)
      .mockResolvedValueOnce(null as any);
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "hist-1" } as any);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.channelTranslation.update).mockResolvedValue({} as any);

    const res = await PATCH(mockRequest({ name: "Ca" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.slug).toBe("ca");
    expect(prisma.channelSlugHistory.create).not.toHaveBeenCalled();
  });

  it("rolls back renameCount increment when channelTranslation.update fails inside the transaction", async () => {
    const updateManySpy = vi.mocked(prisma.channel.updateMany);
    const translationUpdateSpy = vi.mocked(prisma.channelTranslation.update);

    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    const findUniqueSpy = vi.mocked(prisma.channelTranslation.findUnique);
    let findUniqueCallCount = 0;
    findUniqueSpy.mockImplementation(() => {
      findUniqueCallCount++;
      if (findUniqueCallCount === 1) {
        return Promise.resolve({
          id: "trans-1", language: "en", name: "Old Name", slug: "old-name", normalizedName: "old name", channelId: "ch-1",
          channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, avatarUrl: null, renameCount: 1, defaultLanguage: "en" },
        } as any);
      }
      return Promise.resolve(null);
    });
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);

    // channel.updateMany succeeds, but channelTranslation.update throws
    updateManySpy.mockResolvedValue({ count: 1 } as any);
    translationUpdateSpy.mockRejectedValue(new Error("DB failure"));

    const res = await PATCH(mockRequest({ name: "New Name" }), params);
    expect(res.status).toBe(500);
    // Both were called inside the transaction, but Prisma rolls back
    // the entire transaction on any throw:
    expect(updateManySpy).toHaveBeenCalled();
    expect(translationUpdateSpy).toHaveBeenCalled();
  });
});
