import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  default: vi.fn((config: any) => ({
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: vi.fn(),
    config,
  })),
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: (config: any) => config,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/services/channel", () => ({
  getPersonalChannel: vi.fn(),
  createPersonalChannel: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIp: vi.fn(() => "unknown"),
  RATE_LIMITS: {
    login: { limit: 15, windowMs: 900_000 },
  },
  RATE_LIMIT_PREFIX: {
    login: "login",
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import { getPersonalChannel, createPersonalChannel } from "@/lib/services/channel";
import { authConfig } from "@/lib/auth";

describe("auth session version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the current sessionVersion on sign-in", async () => {
    vi.mocked(getPersonalChannel).mockResolvedValue({ id: "channel-1" } as any);

    const token = await authConfig.callbacks!.jwt!({
      token: {},
      user: { id: "user-1", email: "devotee@example.com", name: "Devotee", sessionVersion: 3 } as any,
    } as any);

    expect(token).not.toBeNull();
    expect(token?.id).toBe("user-1");
    expect(token?.email).toBe("devotee@example.com");
    expect(token?.channelId).toBe("channel-1");
    expect(token?.sessionVersion).toBe(3);
    expect(createPersonalChannel).not.toHaveBeenCalled();
  });

  it("returns null for stale JWTs after the password changes", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ sessionVersion: 1 } as any);

    const token = await authConfig.callbacks!.jwt!({
      token: {
        id: "user-1",
        email: "devotee@example.com",
        channelId: "channel-1",
        sessionVersion: 0,
      },
    } as any);

    expect(token).toBeNull();
  });
});
