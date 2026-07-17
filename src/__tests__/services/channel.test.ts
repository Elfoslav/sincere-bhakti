import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    channelEditor: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    channelSlugHistory: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: any) => any) =>
      cb({
        $executeRaw: vi.fn(),
        channel: {
          findFirst: (...args: any[]) => (prisma.channel.findFirst as any)(...args),
          findMany: (...args: any[]) => (prisma.channel.findMany as any)(...args),
          findUnique: (...args: any[]) => (prisma.channel.findUnique as any)(...args),
          count: (...args: any[]) => (prisma.channel.count as any)(...args),
          create: (...args: any[]) => (prisma.channel.create as any)(...args),
        },
        channelEditor: {
          findMany: (...args: any[]) => (prisma.channelEditor.findMany as any)(...args),
          findUnique: (...args: any[]) => (prisma.channelEditor.findUnique as any)(...args),
        },
        channelSlugHistory: {
          findFirst: (...args: any[]) => (prisma.channelSlugHistory.findFirst as any)(...args),
        },
      }),
    ),
  },
}));

import { prisma } from "@/lib/prisma";
import { createPersonalChannel, createChannel, NameTakenError, ChannelLimitError, getAuthorableChannels, canAuthorChannel, resolveAuthorableChannelId } from "@/lib/services/channel";

const baseChannel = {
  id: "",
  name: "",
  slug: "",
  avatarUrl: null,
  ownerId: "user-2",
  isPersonal: true,
  createdAt: new Date(),
};

function mockChannel(id: string, name: string, slug: string) {
  return { ...baseChannel, id, name, slug } as any;
}

describe("createPersonalChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
  });

  it("creates a channel with the user's name when no conflicts", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-1", "Krishna Das", "krishna-das") as any);

    const result = await createPersonalChannel("user-1", "Krishna Das");

    expect(result.name).toBe("Krishna Das");
    expect(result.slug).toBe("krishna-das");
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { name: "Krishna Das", normalizedName: "krishna das", slug: "krishna-das", ownerId: "user-1", isPersonal: true },
    });
  });

  it("returns existing channel if user already has one", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    const existing = mockChannel("ch-1", "Devotee", "devotee");
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(existing as any);

    const result = await createPersonalChannel("user-1", "Krishna Das");

    expect(result.name).toBe("Devotee");
    expect(prisma.channel.create).not.toHaveBeenCalled();
  });

  it("appends suffix when slug is taken", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce(null)           // owner check
      .mockResolvedValueOnce({ id: "taken" } as any) // slugTaken for krishna-das
      .mockResolvedValueOnce(null);          // slugTaken for krishna-das-2
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-2", "Krishna Das", "krishna-das-2") as any);

    const result = await createPersonalChannel("user-2", "Krishna Das");

    expect(result.slug).toBe("krishna-das-2");
  });

  it("falls back to UUID suffix when retries are exhausted", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce(null)           // existing check
      .mockResolvedValue({ id: "taken" } as any); // all slugTaken return taken
    const fallbackSlug = "test-abc12345";
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-99", "Test", fallbackSlug) as any);

    const result = await createPersonalChannel("user-99", "Test");

    expect(result.slug).toBe(fallbackSlug);
  });
});

describe("getAuthorableChannels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
  });

  it("returns owned channels and editable channels without duplicates", async () => {
    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      { id: "ch-1", name: "Personal", slug: "personal", avatarUrl: null, ownerId: "user-1", isPersonal: true },
      { id: "ch-2", name: "Owned", slug: "owned", avatarUrl: null, ownerId: "user-1", isPersonal: false },
    ] as any);
    vi.mocked(prisma.channelEditor.findMany).mockResolvedValue([
      {
        channelId: "ch-2",
        userId: "user-1",
        role: "editor",
        channel: { id: "ch-2", name: "Owned", slug: "owned", avatarUrl: null, ownerId: "user-1", isPersonal: false },
      },
      {
        channelId: "ch-3",
        userId: "user-1",
        role: "editor",
        channel: { id: "ch-3", name: "Editable", slug: "editable", avatarUrl: null, ownerId: "user-2", isPersonal: false },
      },
    ] as any);

    const result = await getAuthorableChannels("user-1");

    expect(result).toEqual([
      { id: "ch-1", name: "Personal", slug: "personal", avatarUrl: null, ownerId: "user-1", isPersonal: true, role: "owner" },
      { id: "ch-2", name: "Owned", slug: "owned", avatarUrl: null, ownerId: "user-1", isPersonal: false, role: "owner" },
      { id: "ch-3", name: "Editable", slug: "editable", avatarUrl: null, ownerId: "user-2", isPersonal: false, role: "editor" },
    ]);
  });
});

describe("canAuthorChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
  });

  it("allows channel owner", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

    await expect(canAuthorChannel("ch-1", "user-1")).resolves.toBe(true);
    expect(prisma.channelEditor.findUnique).not.toHaveBeenCalled();
  });

  it("allows channel editor", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-2" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "user-1" } as any);

    await expect(canAuthorChannel("ch-1", "user-1")).resolves.toBe(true);
  });

  it("rejects non-author", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-2" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);

    await expect(canAuthorChannel("ch-1", "user-1")).resolves.toBe(false);
  });
});

describe("resolveAuthorableChannelId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
  });

  it("accepts explicit authorable channel", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

    const result = await resolveAuthorableChannelId({
      explicitChannelId: "ch-1",
      preferredChannelId: "stale",
      fallbackChannelId: "personal",
      userId: "user-1",
    });

    expect(result).toEqual({ channelId: "ch-1", shouldRefreshPreference: false, explicitForbidden: false });
  });

  it("forbids explicit non-authorable channel", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-2" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);

    const result = await resolveAuthorableChannelId({
      explicitChannelId: "ch-1",
      fallbackChannelId: "personal",
      userId: "user-1",
    });

    expect(result).toEqual({ channelId: undefined, shouldRefreshPreference: false, explicitForbidden: true });
  });

  it("falls back from stale preferred channel and asks caller to refresh preference", async () => {
    vi.mocked(prisma.channel.findUnique)
      .mockResolvedValueOnce({ ownerId: "user-2" } as any)
      .mockResolvedValueOnce({ ownerId: "user-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);

    const result = await resolveAuthorableChannelId({
      preferredChannelId: "stale",
      fallbackChannelId: "personal",
      userId: "user-1",
    });

    expect(result).toEqual({ channelId: "personal", shouldRefreshPreference: true, explicitForbidden: false });
  });
});

describe("createChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
  });

  it("creates a non-personal channel with the given name", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-1", name: "My Devotees", normalizedName: "my devotees", slug: "my-devotees", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
    } as any);

    const result = await createChannel("user-1", "My Devotees");

    expect(result.name).toBe("My Devotees");
    expect(result.slug).toBe("my-devotees");
    expect(result.postCount).toBe(0);
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { name: "My Devotees", normalizedName: "my devotees", slug: "my-devotees", ownerId: "user-1", isPersonal: false },
    });
  });

  it("throws NameTakenError when normalizedName is taken by an active channel", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce({ id: "taken" } as any);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);

    await expect(createChannel("user-1", "My Devotees")).rejects.toThrow(NameTakenError);
  });

  it("appends suffix when slug is taken", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce(null)                  // i=1: normalizedName free
      .mockResolvedValueOnce({ id: "taken" } as any) // i=1: slug collision for my-devotees
      .mockResolvedValueOnce(null);                  // i=2: slot free
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-3", name: "My Devotees (2)", normalizedName: "my devotees (2)", slug: "my-devotees-2", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
    } as any);

    const result = await createChannel("user-1", "My Devotees");

    expect(result.slug).toBe("my-devotees-2");
    expect(result.name).toBe("My Devotees (2)");
  });

  it("retries the whole transaction after a P2002 and succeeds on the next suffix", async () => {
    const transactionMock = vi.mocked(prisma.$transaction);
    const p2002 = Object.assign(new Error("unique conflict"), { code: "P2002" });

    function createTx({ slugTakenOnFirstSlug, failCreate }: { slugTakenOnFirstSlug: boolean; failCreate: boolean }) {
      let aborted = false;
      const assertActive = () => {
        if (aborted) throw new Error("transaction_aborted");
      };

      return {
        $executeRaw: vi.fn(async () => {
          assertActive();
        }),
        channel: {
          count: vi.fn(async () => {
            assertActive();
            return 0;
          }),
          findFirst: vi.fn(async (args: { where: Record<string, any> }) => {
            assertActive();
            if ("normalizedName" in args.where) return null;
            if ("oldNormalizedName" in args.where) return null;
            if ("oldSlug" in args.where) return null;
            if (args.where.slug === "my-devotees") {
              return slugTakenOnFirstSlug ? { id: "taken" } as any : null;
            }
            if (args.where.slug === "my-devotees-2") {
              return null;
            }
            return null;
          }),
          create: vi.fn(async () => {
            assertActive();
            if (failCreate) {
              aborted = true;
              throw p2002;
            }
            return {
              id: "ch-2",
              name: "My Devotees (2)",
              normalizedName: "my devotees (2)",
              slug: "my-devotees-2",
              avatarUrl: null,
              ownerId: "user-1",
              isPersonal: false,
              createdAt: new Date(),
            } as any;
          }),
        },
        channelSlugHistory: {
          findFirst: vi.fn(async () => {
            assertActive();
            return null;
          }),
        },
      };
    }

    transactionMock
      .mockImplementationOnce((cb: (tx: any) => any) => cb(createTx({ slugTakenOnFirstSlug: false, failCreate: true })))
      .mockImplementationOnce((cb: (tx: any) => any) => cb(createTx({ slugTakenOnFirstSlug: true, failCreate: false })));

    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);

    const result = await createChannel("user-1", "My Devotees");

    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(result.slug).toBe("my-devotees-2");
    expect(result.name).toBe("My Devotees (2)");
  });

  it("falls back to UUID suffix when retries are exhausted", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce(null)           // normalizedName free
      .mockResolvedValue({ id: "taken" } as any); // all slug collisions
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-99", name: "Test (abc12345)", normalizedName: "test (abc12345)", slug: "test-abc12345", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
    } as any);

    const result = await createChannel("user-1", "Test");

    expect(result.slug).toBe("test-abc12345");
    expect(result.name).toBe("Test (abc12345)");
  });

  it("throws ChannelLimitError when the user has too many additional channels", async () => {
    const previous = process.env.MAX_CHANNELS_PER_USER;
    try {
      process.env.MAX_CHANNELS_PER_USER = "1";
      vi.mocked(prisma.channel.count).mockResolvedValue(1);

      await expect(createChannel("user-1", "Test")).rejects.toBeInstanceOf(ChannelLimitError);
    } finally {
      process.env.MAX_CHANNELS_PER_USER = previous;
    }
  });
});
