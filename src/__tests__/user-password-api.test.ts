import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";
import { PATCH } from "@/app/api/users/[id]/password/route";

function mockRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

describe("PATCH /api/users/[id]/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
  });

  it("changes the password for the authenticated owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: "hashed-current" } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-new" as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await PATCH(
      mockRequest({ currentPassword: "current-secret", newPassword: "new-secret123" }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith("current-secret", "hashed-current");
    expect(bcrypt.hash).toHaveBeenCalledWith("new-secret123", 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "hashed-new", sessionVersion: { increment: 1 } },
    });
  });

  it("trims incidental whitespace from the current password before comparing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: "hashed-current" } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-new" as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const res = await PATCH(
      mockRequest({ currentPassword: "  current-secret  ", newPassword: "new-secret123" }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith("current-secret", "hashed-current");
  });

  it("returns 403 when the caller is not the owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "other-user" } } as any);

    const res = await PATCH(
      mockRequest({ currentPassword: "current-secret", newPassword: "new-secret123" }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("returns 400 when the current password is wrong", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: "hashed-current" } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const res = await PATCH(
      mockRequest({ currentPassword: "wrong-secret", newPassword: "new-secret123" }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid_password");
  });

  it("returns 400 on invalid input", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const res = await PATCH(
      mockRequest({ currentPassword: "", newPassword: "short" }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("validation_error:");
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(checkRateLimit).mockResolvedValueOnce(false);

    const res = await PATCH(
      mockRequest({ currentPassword: "current-secret", newPassword: "new-secret123" }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
  });
});
