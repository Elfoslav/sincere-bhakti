import { describe, it, expect, vi, beforeEach } from "vitest";
import { CHANNEL_ROLE_ADMIN } from "@/lib/channel-roles";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    channelTranslation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    channelSlugHistory: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    channelEditor: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => any) => {
      const outer = prisma;
      return cb({
        channel: {
          findUnique: (...args: any[]) => (outer.channel.findUnique as any)(...args),
          updateMany: (...args: any[]) => (outer.channel.updateMany as any)(...args),
        },
        channelEditor: {
          findUnique: (...args: any[]) => (outer.channelEditor.findUnique as any)(...args),
        },
        channelTranslation: {
          findFirst: (...args: any[]) => (outer.channelTranslation.findFirst as any)(...args),
          findUnique: (...args: any[]) => (outer.channelTranslation.findUnique as any)(...args),
          update: (...args: any[]) => (outer.channelTranslation.update as any)(...args),
          updateMany: (...args: any[]) => (outer.channelTranslation.updateMany as any)(...args),
          create: (...args: any[]) => (outer.channelTranslation.create as any)(...args),
          count: (...args: any[]) => (outer.channelTranslation.count as any)(...args),
          deleteMany: (...args: any[]) => (outer.channelTranslation.deleteMany as any)(...args),
        },
        channelSlugHistory: {
          findFirst: (...args: any[]) => (outer.channelSlugHistory.findFirst as any)(...args),
          create: (...args: any[]) => (outer.channelSlugHistory.create as any)(...args),
        },
        $executeRaw: vi.fn(async () => []),
      });
    }),
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/rate-limit", () => {
  const mockRateLimit = vi.fn(() => ({ allowed: true, remaining: 9, resetIn: 3_600_000 }));
  const RATE_LIMITS = { updateChannel: { limit: 20, windowMs: 3_600_000 } };
  const rateLimitKey = (prefix: string, id: string) => `${prefix}:${id}`;
  return {
    RATE_LIMIT_PREFIX: { updateChannel: "update-channel" },
    RATE_LIMITS,
    rateLimitKey,
    rateLimit: mockRateLimit,
    getClientIp: (headers: Headers) => headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    checkRateLimit: vi.fn(async () => true),
    __esModule: true,
  };
});
vi.mock("@/lib/services/channel", async (importOriginal) => ({
  ...(await importOriginal()),
  canManageChannelSettings: vi.fn(async () => true),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { POST, DELETE } from "@/app/api/channels/[slug]/translations/route";

function mockRequest(body?: unknown, url?: string): any {
  return {
    url: url ?? "http://localhost:3000/api/channels/my-channel/translations",
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

const params = { params: Promise.resolve({ slug: "my-channel" }) };

describe("POST /api/channels/[slug]/translations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a new translation without consuming a rename", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    // Anchor (URL slug → channel) resolves via findFirst; then name check (null).
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
      } as any)
      .mockResolvedValue(null);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce(null as any);    // no existing translation → create
    vi.mocked(prisma.channelTranslation.create).mockResolvedValue({
      id: "trans-cs", language: "cs", name: "Můj kanál", slug: "muj-kanal",
    } as any);

    const res = await POST(mockRequest({ name: "Můj kanál", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("Můj kanál");
    expect(json.slug).toBe("muj-kanal");
    expect(json.renameCount).toBe(0);
    expect(prisma.channelTranslation.updateMany).not.toHaveBeenCalled();
  });

  it("updates an existing translation and increments renameCount when name changes", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
      } as any) // anchor
      .mockResolvedValue(null); // name check
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Old Name", slug: "old-name", renameCount: 1 } as any) // existing translation
      .mockResolvedValueOnce(null as any)    // slug not taken
      .mockResolvedValueOnce({ id: "trans-cs", normalizedName: "old name", previousNormalizedNames: [] } as any); // fetch prev names inside service
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null); // owner check — not an editor
    vi.mocked(prisma.channelTranslation.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.channelTranslation.update).mockResolvedValue({
      id: "trans-cs", language: "cs", name: "New Name", slug: "new-name",
    } as any);

    const res = await POST(mockRequest({ name: "New Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("New Name");
    expect(json.slug).toBe("new-name");
    expect(json.renameCount).toBe(2);
    expect(prisma.channelTranslation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "trans-cs",
          renameCount: { lt: 3 },
        },
        data: { renameCount: { increment: 1 }, name: "New Name", normalizedName: "new name", slug: "new-name", previousNormalizedNames: { push: ["old name"] } },
      }),
    );
  });

  it("does not increment renameCount (and does not self-collide on slug) when editing to the same name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
      } as any) // anchor
      .mockResolvedValue(null); // name check
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Same Name", slug: "same-name", renameCount: 2 } as any); // existing translation
    vi.mocked(prisma.channelTranslation.update).mockResolvedValue({
      id: "trans-cs", language: "cs", name: "Same Name", slug: "same-name",
    } as any);

    const res = await POST(mockRequest({ name: "Same Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.renameCount).toBe(2);
    expect(prisma.channelTranslation.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when rename limit is reached", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
      } as any) // anchor
      .mockResolvedValue(null); // name check
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Old Name", slug: "old-name", renameCount: 3 } as any) // existing translation
      .mockResolvedValueOnce(null as any)    // slug not taken
      .mockResolvedValueOnce({ id: "trans-cs", normalizedName: "old name", previousNormalizedNames: [] } as any); // fetch prev names inside service
    vi.mocked(prisma.channelTranslation.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await POST(mockRequest({ name: "New Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("rename_limit_reached");
  });

  it("returns 400 when trying to rename a personal channel translation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: true },
      } as any) // anchor
      .mockResolvedValue(null); // name check
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Old Name", slug: "old-name" } as any); // existing translation

    const res = await POST(mockRequest({ name: "New Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("cannot_rename_personal_channel");
  });

  it("returns 400 on missing language", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue({
      id: "existing-trans", slug: "my-channel",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
    } as any);

    const res = await POST(mockRequest({ name: "Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("validation_error:language:invalid_type");
  });

  it("returns 409 when name is taken by another channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
      } as any) // anchor
      .mockResolvedValueOnce({ id: "taken" } as any); // name check → taken by another channel

    const res = await POST(mockRequest({ name: "Taken Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
    // The name-ownership check spans ALL languages (no language filter) and only
    // excludes the channel itself — a name owned by another channel is blocked
    // regardless of the target translation's language.
    expect(prisma.channelTranslation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedName: "taken name", channelId: { not: "ch-1" } } }),
    );
  });

  it("returns 409 when the target slug is held by a DIFFERENT translation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
      } as any) // anchor
      .mockResolvedValue(null); // name check
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Old Name", slug: "old-name" } as any) // existing translation
      .mockResolvedValueOnce({ id: "some-other-trans" } as any); // slug held by another row → real collision

    const res = await POST(mockRequest({ name: "New Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("allows a channel to reuse its OWN name in another language", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    // The channel already has an "en" translation named "Devotees". Adding a
    // "cs" translation with the same name must succeed: the name-ownership check
    // excludes this channel, and slugs are unique per-language.
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "trans-en", slug: "devotees", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
      } as any) // anchor
      .mockResolvedValue(null); // name check excludes ch-1 → not taken elsewhere
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValueOnce(null as any); // no cs translation yet → create
    vi.mocked(prisma.channelTranslation.create).mockResolvedValue({
      id: "trans-cs", language: "cs", name: "Devotees", slug: "devotees",
    } as any);

    const res = await POST(mockRequest({ name: "Devotees", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.language).toBe("cs");
    expect(json.slug).toBe("devotees");
    // The name-ownership check is global across languages but excludes the channel itself.
    expect(prisma.channelTranslation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedName: "devotees", channelId: { not: "ch-1" } } }),
    );
    // A per-language slug identical to the en translation's slug is allowed.
    expect(prisma.channelTranslation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channelId: "ch-1", language: "cs", slug: "devotees", normalizedName: "devotees" }) }),
    );
  });

  it("rejects (409) when the derived slug is already taken in that language (no auto-suffix)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValueOnce({
        id: "trans-en", slug: "devotees-en", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
      } as any) // anchor
      .mockResolvedValue(null); // name check (name is free)
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce(null as any)            // no cs translation yet → create branch
      .mockResolvedValueOnce({ id: "other-channel" } as any); // slug "devotees" already taken in cs
    vi.mocked(prisma.channelTranslation.create).mockResolvedValue({} as any);

    const res = await POST(mockRequest({ name: "Devotees", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
    // Name+slug both gate uniqueness → no suffixing, and nothing is created.
    expect(prisma.channelTranslation.create).not.toHaveBeenCalled();
  });

  it("blocks the brand name in another language for a non-owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", email: "someone@example.com" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue({
      id: "trans-en", slug: "my-channel", language: "en",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
    } as any);

    const res = await POST(mockRequest({ name: "Sincere Bhakti", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
    // Brand name is rejected before any create is attempted.
    expect(prisma.channelTranslation.create).not.toHaveBeenCalled();
  });

  it("allows the brand name in another language for the SINCERE_BHAKTI_EMAIL owner", async () => {
    const prev = process.env.SINCERE_BHAKTI_EMAIL;
    try {
      process.env.SINCERE_BHAKTI_EMAIL = "owner@sincerebhakti.com";
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", email: "owner@sincerebhakti.com" } } as any);
      vi.mocked(prisma.channelTranslation.findFirst)
        .mockResolvedValueOnce({
          id: "trans-en", slug: "sincere-bhakti", language: "en",
          channel: { id: "ch-1", ownerId: "user-1", isPersonal: false },
        } as any) // anchor
        .mockResolvedValue(null); // name check
      vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValueOnce(null as any); // no cs translation → create
      vi.mocked(prisma.channelTranslation.create).mockResolvedValue({
        id: "trans-cs", language: "cs", name: "Sincere Bhakti", slug: "sincere-bhakti",
      } as any);

      const res = await POST(mockRequest({ name: "Sincere Bhakti", language: "cs" }), params);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.slug).toBe("sincere-bhakti");
    } finally {
      process.env.SINCERE_BHAKTI_EMAIL = prev;
    }
  });
});

describe("DELETE /api/channels/[slug]/translations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a translation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue({
      id: "trans-cs", slug: "my-channel",
      channel: { id: "ch-1" },
    } as any);
    vi.mocked(prisma.channelTranslation.count).mockResolvedValue(2);
    vi.mocked(prisma.channelTranslation.deleteMany).mockResolvedValue({ count: 1 } as any);

    const res = await DELETE(mockRequest({}, "http://localhost:3000/api/channels/my-channel/translations?language=cs"), { params: Promise.resolve({ slug: "my-channel" }) } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.channelTranslation.deleteMany).toHaveBeenCalledWith({
      where: { channelId: "ch-1", language: "cs" },
    });
  });

  it("returns 400 when trying to delete the last translation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue({
      id: "trans-cs", slug: "my-channel",
      channel: { id: "ch-1" },
    } as any);
    vi.mocked(prisma.channelTranslation.count).mockResolvedValue(1);

    const res = await DELETE(mockRequest({}, "http://localhost:3000/api/channels/my-channel/translations?language=cs"), { params: Promise.resolve({ slug: "my-channel" }) } as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("cannot_remove_last_translation");
    expect(prisma.channelTranslation.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 on missing language query param", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await DELETE(mockRequest({}, "http://localhost:3000/api/channels/my-channel/translations"), { params: Promise.resolve({ slug: "my-channel" }) } as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("validation_error:language:required");
  });
});
