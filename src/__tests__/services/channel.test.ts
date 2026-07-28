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
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    channelSlugHistory: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    channelTranslation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
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
          create: (...args: any[]) => (prisma.channelEditor.create as any)(...args),
          update: (...args: any[]) => (prisma.channelEditor.update as any)(...args),
          upsert: (...args: any[]) => (prisma.channelEditor.upsert as any)(...args),
        },
        user: {
          findUnique: (...args: any[]) => (prisma.user.findUnique as any)(...args),
        },
        channelSlugHistory: {
          findFirst: (...args: any[]) => (prisma.channelSlugHistory.findFirst as any)(...args),
          findUnique: (...args: any[]) => (prisma.channelSlugHistory.findUnique as any)(...args),
        },
        channelTranslation: {
          findFirst: (...args: any[]) => (prisma.channelTranslation.findFirst as any)(...args),
          findUnique: (...args: any[]) => (prisma.channelTranslation.findUnique as any)(...args),
          update: (...args: any[]) => (prisma.channelTranslation.update as any)(...args),
          create: (...args: any[]) => (prisma.channelTranslation.create as any)(...args),
          findMany: (...args: any[]) => (prisma.channelTranslation.findMany as any)(...args),
          upsert: (...args: any[]) => (prisma.channelTranslation.upsert as any)(...args),
        },
      }),
    ),
  },
}));

import { prisma } from "@/lib/prisma";
import { CHANNEL_ROLE_ADMIN, CHANNEL_ROLE_EDITOR, CHANNEL_ROLE_OWNER } from "@/lib/channel-roles";
import {
  CannotAddChannelOwnerError,
  ChannelMemberAlreadyExistsError,
  ChannelMemberTransactionConflictError,
  ChannelLimitError,
  NameTakenError,
  NotFoundError,
  UserNotFoundError,
  addChannelMemberByEmail,
  canAuthorChannel,
  canManageChannelSettings,
  createChannel,
  createPersonalChannel,
  getAuthorableChannels,
  resolveAuthorableChannelId,
  resolveSlugRedirect,
  updateChannelMemberByEmail,
} from "@/lib/services/channel";

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
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-1", "Krishna Das", "krishna-das") as any);

    const result = await createPersonalChannel("user-1", "Krishna Das");

    expect(result.name).toBe("Krishna Das");
    expect(result.slug).toBe("krishna-das");
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { ownerId: "user-1", isPersonal: true, translations: { create: { language: "en", name: "Krishna Das", normalizedName: "krishna das", slug: "krishna-das" } } },
    });
  });

  it("returns existing channel if user already has one", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    const existing = { ...mockChannel("ch-1", "Devotee", "devotee"), translations: [{ language: "en", name: "Devotee", slug: "devotee" }] };
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(existing as any);

    const result = await createPersonalChannel("user-1", "Krishna Das");

    expect(result.name).toBe("Devotee");
    expect(prisma.channel.create).not.toHaveBeenCalled();
  });

  it("appends suffix when slug is taken", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({ id: "taken" } as any)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.channelSlugHistory.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-2", "Krishna Das", "krishna-das-2") as any);

    const result = await createPersonalChannel("user-2", "Krishna Das");

    expect(result.slug).toBe("krishna-das-2");
  });

  it("falls back to UUID suffix when retries are exhausted", async () => {
    vi.mocked(prisma.channel.count).mockResolvedValue(0);
    vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({ id: "taken" } as any);
    const fallbackSlug = "test-abc12345";
    vi.mocked(prisma.channel.create).mockResolvedValue(mockChannel("ch-99", "Test", fallbackSlug) as any);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("abc12345-0000-0000-0000-000000000000");

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
      { id: "ch-1", name: "Personal", slug: "personal", avatarUrl: null, ownerId: "user-1", isPersonal: true, translations: [{ language: "en", name: "Personal", slug: "personal" }] },
      { id: "ch-2", name: "Owned", slug: "owned", avatarUrl: null, ownerId: "user-1", isPersonal: false, translations: [{ language: "en", name: "Owned", slug: "owned" }] },
    ] as any);
    vi.mocked(prisma.channelEditor.findMany).mockResolvedValue([
      {
        channelId: "ch-2",
        userId: "user-1",
        role: CHANNEL_ROLE_EDITOR,
        channel: { id: "ch-2", name: "Owned", slug: "owned", avatarUrl: null, ownerId: "user-1", isPersonal: false, translations: [{ language: "en", name: "Owned", slug: "owned" }] },
      },
      {
        channelId: "ch-3",
        userId: "user-1",
        role: CHANNEL_ROLE_ADMIN,
        channel: { id: "ch-3", name: "Admin", slug: "admin", avatarUrl: null, ownerId: "user-2", isPersonal: false, translations: [{ language: "en", name: "Admin", slug: "admin" }] },
      },
      {
        channelId: "ch-4",
        userId: "user-1",
        role: CHANNEL_ROLE_EDITOR,
        channel: { id: "ch-4", name: "Editable", slug: "editable", avatarUrl: null, ownerId: "user-3", isPersonal: false, translations: [{ language: "en", name: "Editable", slug: "editable" }] },
      },
    ] as any);

    const result = await getAuthorableChannels("user-1");

    expect(result).toEqual([
      { id: "ch-1", name: "Personal", slug: "personal", avatarUrl: null, ownerId: "user-1", isPersonal: true, role: CHANNEL_ROLE_OWNER },
      { id: "ch-2", name: "Owned", slug: "owned", avatarUrl: null, ownerId: "user-1", isPersonal: false, role: CHANNEL_ROLE_OWNER },
      { id: "ch-3", name: "Admin", slug: "admin", avatarUrl: null, ownerId: "user-2", isPersonal: false, role: CHANNEL_ROLE_ADMIN },
      { id: "ch-4", name: "Editable", slug: "editable", avatarUrl: null, ownerId: "user-3", isPersonal: false, role: CHANNEL_ROLE_EDITOR },
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
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ role: CHANNEL_ROLE_EDITOR } as any);

    await expect(canAuthorChannel("ch-1", "user-1")).resolves.toBe(true);
  });

  it("rejects non-author", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-2" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);

    await expect(canAuthorChannel("ch-1", "user-1")).resolves.toBe(false);
  });

  it("rejects membership rows with non-author roles", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-2" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ role: CHANNEL_ROLE_OWNER } as any);

    await expect(canAuthorChannel("ch-1", "user-1")).resolves.toBe(false);
  });
});

describe("canManageChannelSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows channel owner", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "user-1" } as any);

    await expect(canManageChannelSettings("ch-1", "user-1")).resolves.toBe(true);
    expect(prisma.channelEditor.findUnique).not.toHaveBeenCalled();
  });

  it("allows channel admin", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ role: CHANNEL_ROLE_ADMIN } as any);

    await expect(canManageChannelSettings("ch-1", "admin-1")).resolves.toBe(true);
  });

  it("rejects channel editor", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ role: CHANNEL_ROLE_EDITOR } as any);

    await expect(canManageChannelSettings("ch-1", "editor-1")).resolves.toBe(false);
  });

  it("rejects missing channel", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue(null);

    await expect(canManageChannelSettings("missing", "user-1")).resolves.toBe(false);
  });
});

describe("addChannelMemberByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an admin when actor can manage channel settings", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        image: null,
    } as any);
    vi.mocked(prisma.channelEditor.create).mockResolvedValue({
      role: CHANNEL_ROLE_ADMIN,
      user: {
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        image: null,
      },
    } as any);

    const member = await addChannelMemberByEmail({
      channelId: "ch-1",
      email: "admin@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    });

    expect(member).toEqual({
      id: "admin-1",
      name: "Admin User",
      email: "admin@example.com",
      image: null,
      role: CHANNEL_ROLE_ADMIN,
    });
    expect(prisma.channelEditor.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { channelId: "ch-1", userId: "admin-1", role: CHANNEL_ROLE_ADMIN },
    }));
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(prisma.channelEditor.upsert).not.toHaveBeenCalled();
  });

  it("retries serializable transaction conflicts", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(Object.assign(new Error("write conflict"), { code: "P2034" }));
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      name: "Admin User",
      email: "admin@example.com",
      image: null,
    } as any);
    vi.mocked(prisma.channelEditor.create).mockResolvedValue({
      role: CHANNEL_ROLE_ADMIN,
      user: {
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        image: null,
      },
    } as any);

    const member = await addChannelMemberByEmail({
      channelId: "ch-1",
      email: "admin@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    });

    expect(member.role).toBe(CHANNEL_ROLE_ADMIN);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.channelEditor.create).toHaveBeenCalledTimes(1);
  });

  it("throws a domain error when transaction conflicts exhaust retries", async () => {
    const conflict = Object.assign(new Error("write conflict"), { code: "P2034" });
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict);

    await expect(addChannelMemberByEmail({
      channelId: "ch-1",
      email: "admin@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    })).rejects.toThrow(ChannelMemberTransactionConflictError);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not update an existing member from the add path", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "editor-1",
      name: "Editor User",
      email: "editor@example.com",
      image: null,
    } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ userId: "editor-1" } as any);

    await expect(addChannelMemberByEmail({
      channelId: "ch-1",
      email: "editor@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    })).rejects.toThrow(ChannelMemberAlreadyExistsError);
    expect(prisma.channelEditor.create).not.toHaveBeenCalled();
    expect(prisma.channelEditor.update).not.toHaveBeenCalled();
  });

  it("rejects actors who are only editors", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.channelEditor.findUnique).mockResolvedValue({ role: CHANNEL_ROLE_EDITOR } as any);

    await expect(addChannelMemberByEmail({
      channelId: "ch-1",
      email: "user@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "editor-1",
    })).rejects.toThrow(NotFoundError);
    expect(prisma.channelEditor.create).not.toHaveBeenCalled();
  });

  it("throws UserNotFoundError when email does not belong to a user", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(addChannelMemberByEmail({
      channelId: "ch-1",
      email: "missing@example.com",
      role: CHANNEL_ROLE_EDITOR,
      actorUserId: "owner-1",
    })).rejects.toThrow(UserNotFoundError);
  });

  it("does not add the channel owner as a member", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "owner-1",
      name: "Owner",
      email: "owner@example.com",
      image: null,
    } as any);

    await expect(addChannelMemberByEmail({
      channelId: "ch-1",
      email: "owner@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    })).rejects.toThrow(CannotAddChannelOwnerError);
    expect(prisma.channelEditor.create).not.toHaveBeenCalled();
  });
});

describe("updateChannelMemberByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates an existing member role", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "editor-1",
      name: "Editor User",
      email: "editor@example.com",
      image: null,
    } as any);
    vi.mocked(prisma.channelEditor.update).mockResolvedValue({
      role: CHANNEL_ROLE_ADMIN,
      user: {
        id: "editor-1",
        name: "Editor User",
        email: "editor@example.com",
        image: null,
      },
    } as any);

    const member = await updateChannelMemberByEmail({
      channelId: "ch-1",
      email: "editor@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    });

    expect(member.role).toBe(CHANNEL_ROLE_ADMIN);
    expect(prisma.channelEditor.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { channelId_userId: { channelId: "ch-1", userId: "editor-1" } },
      data: { role: CHANNEL_ROLE_ADMIN },
    }));
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(prisma.channelEditor.create).not.toHaveBeenCalled();
  });

  it("retries serializable transaction conflicts", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(Object.assign(new Error("write conflict"), { code: "P2034" }));
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "editor-1",
      name: "Editor User",
      email: "editor@example.com",
      image: null,
    } as any);
    vi.mocked(prisma.channelEditor.update).mockResolvedValue({
      role: CHANNEL_ROLE_ADMIN,
      user: {
        id: "editor-1",
        name: "Editor User",
        email: "editor@example.com",
        image: null,
      },
    } as any);

    const member = await updateChannelMemberByEmail({
      channelId: "ch-1",
      email: "editor@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    });

    expect(member.role).toBe(CHANNEL_ROLE_ADMIN);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.channelEditor.update).toHaveBeenCalledTimes(1);
  });

  it("throws a domain error when transaction conflicts exhaust retries", async () => {
    const conflict = Object.assign(new Error("write conflict"), { code: "P2034" });
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict);

    await expect(updateChannelMemberByEmail({
      channelId: "ch-1",
      email: "editor@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    })).rejects.toThrow(ChannelMemberTransactionConflictError);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not create a missing member from the edit path", async () => {
    vi.mocked(prisma.channel.findUnique).mockResolvedValue({ ownerId: "owner-1" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "editor-1",
      name: "Editor User",
      email: "editor@example.com",
      image: null,
    } as any);
    vi.mocked(prisma.channelEditor.update).mockRejectedValue(Object.assign(new Error("missing"), { code: "P2025" }));

    await expect(updateChannelMemberByEmail({
      channelId: "ch-1",
      email: "editor@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    })).rejects.toThrow(NotFoundError);
    expect(prisma.channelEditor.create).not.toHaveBeenCalled();
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

describe("resolveSlugRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no history entry exists", async () => {
    vi.mocked(prisma.channelSlugHistory.findUnique).mockResolvedValue(null);
    const result = await resolveSlugRedirect("nonexistent");
    expect(result).toBeNull();
  });

  it("returns the matching translation slug when language is provided", async () => {
    vi.mocked(prisma.channelSlugHistory.findUnique).mockResolvedValue({
      id: "hist-1",
      oldSlug: "old-slug",
      oldNormalizedName: "old name",
      channelId: "ch-1",
      createdAt: new Date(),
      channel: {
        id: "ch-1",
        translations: [
          { language: "en", slug: "english-slug" },
          { language: "cs", slug: "cesky-slug" },
        ],
      },
    } as any);

    const result = await resolveSlugRedirect("old-slug", "cs");
    expect(result).toBe("cesky-slug");
  });

  it("falls back to first translation slug when language has no match", async () => {
    vi.mocked(prisma.channelSlugHistory.findUnique).mockResolvedValue({
      id: "hist-1",
      oldSlug: "old-slug",
      oldNormalizedName: "old name",
      channelId: "ch-1",
      createdAt: new Date(),
      channel: {
        id: "ch-1",
        translations: [
          { language: "en", slug: "english-slug" },
          { language: "cs", slug: "cesky-slug" },
        ],
      },
    } as any);

    const result = await resolveSlugRedirect("old-slug", "de");
    expect(result).toBe("english-slug");
  });

  it("returns first translation slug when no language param given", async () => {
    vi.mocked(prisma.channelSlugHistory.findUnique).mockResolvedValue({
      id: "hist-1",
      oldSlug: "old-slug",
      oldNormalizedName: "old name",
      channelId: "ch-1",
      createdAt: new Date(),
      channel: {
        id: "ch-1",
        translations: [
          { language: "en", slug: "english-slug" },
          { language: "cs", slug: "cesky-slug" },
        ],
      },
    } as any);

    const result = await resolveSlugRedirect("old-slug");
    expect(result).toBe("english-slug");
  });

  it("returns null when channel has no translations", async () => {
    vi.mocked(prisma.channelSlugHistory.findUnique).mockResolvedValue({
      id: "hist-1",
      oldSlug: "old-slug",
      oldNormalizedName: "old name",
      channelId: "ch-1",
      createdAt: new Date(),
      channel: {
        id: "ch-1",
        translations: [],
      },
    } as any);

    const result = await resolveSlugRedirect("old-slug", "en");
    expect(result).toBeNull();
  });
});

describe("createChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MAX_CHANNELS_PER_USER;
    vi.mocked(prisma.channel.findMany).mockResolvedValue([]);
  });

  it("creates a non-personal channel with the given name", async () => {
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-1", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
    } as any);

    const result = await createChannel("user-1", "My Devotees");

    expect(result.name).toBe("My Devotees");
    expect(result.slug).toBe("my-devotees");
    expect(result.postCount).toBe(0);
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { ownerId: "user-1", isPersonal: false, translations: { create: { language: "en", name: "My Devotees", normalizedName: "my devotees", slug: "my-devotees" } } },
    });
  });

  it("throws NameTakenError when normalizedName is taken by an active channel", async () => {
    vi.mocked(prisma.channelTranslation.findFirst)
      .mockResolvedValue({ id: "taken" } as any);

    await expect(createChannel("user-1", "My Devotees")).rejects.toThrow(NameTakenError);
  });

  it("appends suffix when slug is taken", async () => {
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelTranslation.findUnique)
      .mockResolvedValueOnce({ id: "taken" } as any)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-3", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
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
          create: vi.fn(async () => {
            assertActive();
            if (failCreate) {
              aborted = true;
              throw p2002;
            }
            return {
              id: "ch-2",
              avatarUrl: null,
              ownerId: "user-1",
              isPersonal: false,
              createdAt: new Date(),
            } as any;
          }),
        },
        channelTranslation: {
          findFirst: vi.fn(async () => {
            assertActive();
            return null;
          }),
          findUnique: vi.fn(async (args: { where: Record<string, any> }) => {
            assertActive();
            if (args.where.slug === "my-devotees") {
              return slugTakenOnFirstSlug ? { id: "taken" } as any : null;
            }
            if (args.where.slug === "my-devotees-2") {
              return null;
            }
            return null;
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
    vi.mocked(prisma.channelTranslation.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.channelSlugHistory.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channelTranslation.findUnique).mockResolvedValue({ id: "taken" } as any);
    vi.mocked(prisma.channel.create).mockResolvedValue({
      id: "ch-99", avatarUrl: null, ownerId: "user-1", isPersonal: false, createdAt: new Date(),
    } as any);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("abc12345-0000-0000-0000-000000000000");

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
