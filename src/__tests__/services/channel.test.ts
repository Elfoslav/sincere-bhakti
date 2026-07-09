import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
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

  it("appends suffix when slug is taken", async () => {
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce(null)           // owner check
      .mockResolvedValueOnce({ id: "taken" } as any) // slugTaken for krishna-das
      .mockResolvedValueOnce(null);          // slugTaken for krishna-das-2
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-2", "Krishna Das", "krishna-das-2") as any);

    const result = await createPersonalChannel("user-2", "Krishna Das");

    expect(result.slug).toBe("krishna-das-2");
  });

  it("falls back to UUID suffix when retries are exhausted", async () => {
    vi.mocked(prisma.channel.findFirst)
      .mockResolvedValueOnce(null)           // existing check
      .mockResolvedValue({ id: "taken" } as any); // all slugTaken return taken
    const fallbackSlug = "test-abc12345";
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-99", "Test", fallbackSlug) as any);

    const result = await createPersonalChannel("user-99", "Test");

    expect(result.slug).toBe(fallbackSlug);
  });
});