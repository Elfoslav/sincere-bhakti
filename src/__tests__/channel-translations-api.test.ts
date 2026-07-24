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
          updateMany: (...args: any[]) => (outer.channel.updateMany as any)(...args),
        },
        channelTranslation: {
          findFirst: (...args: any[]) => (outer.channelTranslation.findFirst as any)(...args),
          findUnique: (...args: any[]) => (outer.channelTranslation.findUnique as any)(...args),
          update: (...args: any[]) => (outer.channelTranslation.update as any)(...args),
          create: (...args: any[]) => (outer.channelTranslation.create as any)(...args),
        },
        channelSlugHistory: {
          findFirst: (...args: any[]) => (outer.channelSlugHistory.findFirst as any)(...args),
          create: (...args: any[]) => (outer.channelSlugHistory.create as any)(...args),
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
import { POST } from "@/app/api/channels/[slug]/translations/route";

function mockRequest(body?: unknown): any {
  return {
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
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, renameCount: 2 },
      } as any)
      .mockResolvedValueOnce(null as any);    // no existing translation → create
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelTranslation.create).mockResolvedValue({
      id: "trans-cs", language: "cs", name: "Můj kanál", slug: "muj-kanal",
    } as any);

    const res = await POST(mockRequest({ name: "Můj kanál", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("Můj kanál");
    expect(json.slug).toBe("muj-kanal");
    expect(json.renameCount).toBe(2);
    expect(prisma.channel.updateMany).not.toHaveBeenCalled();
  });

  it("updates an existing translation and increments renameCount when name changes", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, renameCount: 1 },
      } as any)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Old Name", slug: "old-name" } as any) // existing translation
      .mockResolvedValueOnce(null as any);    // slug not taken
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.channelTranslation.update).mockResolvedValue({
      id: "trans-cs", language: "cs", name: "New Name", slug: "new-name",
    } as any);

    const res = await POST(mockRequest({ name: "New Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("New Name");
    expect(json.slug).toBe("new-name");
    expect(json.renameCount).toBe(2);
    expect(prisma.channel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "ch-1",
          renameCount: { lt: 3 },
          OR: [
            { ownerId: "user-1" },
            { editors: { some: { userId: "user-1", role: CHANNEL_ROLE_ADMIN } } },
          ],
        }),
        data: { renameCount: { increment: 1 } },
      }),
    );
  });

  it("does not increment renameCount (and does not self-collide on slug) when editing to the same name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, renameCount: 2 },
      } as any)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Same Name", slug: "same-name" } as any); // existing translation
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelTranslation.update).mockResolvedValue({
      id: "trans-cs", language: "cs", name: "Same Name", slug: "same-name",
    } as any);

    const res = await POST(mockRequest({ name: "Same Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.renameCount).toBe(2);
    expect(prisma.channel.updateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when rename limit is reached", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, renameCount: 3 },
      } as any)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Old Name", slug: "old-name" } as any) // existing translation
      .mockResolvedValueOnce(null as any);    // slug not taken
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await POST(mockRequest({ name: "New Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("rename_limit_reached");
  });

  it("returns 400 when trying to rename a personal channel translation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: true, renameCount: 0 },
      } as any)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Old Name", slug: "old-name" } as any); // existing translation
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);

    const res = await POST(mockRequest({ name: "New Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("cannot_rename_personal_channel");
  });

  it("returns 400 on missing language", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({
      id: "existing-trans", slug: "my-channel",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, renameCount: 0 },
    } as any);

    const res = await POST(mockRequest({ name: "Name" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("validation_error:language:required");
  });

  it("returns 409 when name is taken by another channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValueOnce({
      id: "existing-trans", slug: "my-channel",
      channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, renameCount: 0 },
    } as any);
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue({ id: "taken" } as any);

    const res = await POST(mockRequest({ name: "Taken Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });

  it("returns 409 when the target slug is held by a DIFFERENT translation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({
        id: "existing-trans", slug: "my-channel", language: "en",
        channel: { id: "ch-1", ownerId: "user-1", isPersonal: false, renameCount: 0 },
      } as any)
      .mockResolvedValueOnce({ id: "trans-cs", language: "cs", name: "Old Name", slug: "old-name" } as any) // existing translation
      .mockResolvedValueOnce({ id: "some-other-trans" } as any); // slug held by another row → real collision
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);

    const res = await POST(mockRequest({ name: "New Name", language: "cs" }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });
});
