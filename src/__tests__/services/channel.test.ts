import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { createPersonalChannel } from "@/lib/services/channel";

const baseChannel = {
  id: "",
  name: "",
  slug: "",
  avatarUrl: null,
  ownerId: "user-2",
  createdAt: new Date(),
};

function mockChannel(id: string, name: string, slug: string) {
  return { ...baseChannel, id, name, slug } as any;
}

describe("createPersonalChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a channel with the user's name when no conflicts", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-1", "Krishna Das", "krishna-das") as any);

    const result = await createPersonalChannel("user-1", "Krishna Das");

    expect(result.name).toBe("Krishna Das");
    expect(result.slug).toBe("krishna-das");
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { name: "Krishna Das", slug: "krishna-das", ownerId: "user-1" },
    });
  });

  it("returns existing channel if user already has one", async () => {
    const existing = mockChannel("ch-1", "Devotee", "devotee");
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(existing as any);

    const result = await createPersonalChannel("user-1", "Krishna Das");

    expect(result.name).toBe("Devotee");
    expect(prisma.channel.create).not.toHaveBeenCalled();
  });

  it("appends (2) when name has a diacritic variant of an existing channel", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([{ name: "Taruṇa Govinda Dāsa" }] as any);
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-2", "Taruna Govinda Dasa (2)", "taruna-govinda-dasa-2") as any);

    const result = await createPersonalChannel("user-2", "Taruna Govinda Dasa");

    expect(result.name).toBe("Taruna Govinda Dasa (2)");
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Taruna Govinda Dasa (2)",
        slug: "taruna-govinda-dasa-2",
      }),
    });
  });

  it("appends (2) when name is an exact match of an existing channel", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([{ name: "Krishna Das" }] as any);
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-2", "Krishna Das (2)", "krishna-das-2") as any);

    const result = await createPersonalChannel("user-2", "Krishna Das");

    expect(result.name).toBe("Krishna Das (2)");
  });

  it("handles French accents colliding with ASCII variant", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([{ name: "Jose Maria" }] as any);
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-3", "José María (2)", "jose-maria-2") as any);

    const result = await createPersonalChannel("user-3", "José María");

    expect(result.name).toBe("José María (2)");
  });

  it("retries with incrementing suffix when collisions cascade", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.findMany).mockResolvedValue([{ name: "Devotee" }, { name: "Devotee (2)" }] as any);
    vi.mocked(prisma.channel.create)
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce(mockChannel("ch-4", "Devotee (3)", "devotee-3") as any);

    const result = await createPersonalChannel("user-4", "Devotee");

    expect(result.name).toBe("Devotee (3)");
    expect(prisma.channel.create).toHaveBeenCalledTimes(2);
  });

  it("falls back to UUID suffix when 1000 attempts are exhausted", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    const takenNames = Array.from({ length: 999 }, (_, i) => ({ name: i === 0 ? "Test" : `Test (${i + 1})` }));
    vi.mocked(prisma.channel.findMany).mockResolvedValue(takenNames as any);
    (vi.mocked(prisma.channel.create) as any).mockImplementation(async ({ data }: any) =>
      mockChannel("ch-99", data.name, data.slug),
    );

    const result = await createPersonalChannel("user-99", "Test");

    expect(result.name).toMatch(/^Test \([a-f0-9-]+\)$/);
    expect(result.slug).toMatch(/^test-[a-f0-9-]+$/);
  });
});
