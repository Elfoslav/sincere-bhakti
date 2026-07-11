import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    channel: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn() }, hash: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/register/route";

function mockRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  } as any;
}

describe("POST /api/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.channel.create).mockResolvedValue({ id: "ch-1", name: "Krishna Das", normalizedName: "krishna das", slug: "krishna-das", avatarUrl: null, createdAt: new Date(), ownerId: "user-1" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "user-1",
      name: "Krishna Das",
      email: "kdas@example.com",
      password: "hashed-password",
      image: null,
      createdAt: new Date(),
    });

    const res = await POST(mockRequest({
      name: "Krishna Das",
      email: "kdas@example.com",
      password: "secret123",
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.name).toBe("Krishna Das");
    expect(json.email).toBe("kdas@example.com");
    expect(bcrypt.hash).toHaveBeenCalledWith("secret123", 12); // BCRYPT_SALT_ROUNDS
  });

  it("returns a generic 400 on duplicate email without revealing which field collided", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    // Prisma throws a unique-constraint error (P2002) when the email already exists.
    vi.mocked(prisma.user.create).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const res = await POST(mockRequest({
      name: "New User",
      email: "used@example.com",
      password: "secret123",
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("registration_failed");
    // Must NOT reveal that the email specifically is in use.
    expect(JSON.stringify(json)).not.toContain("email");
  });

  it("returns 400 on invalid input", async () => {
    const res = await POST(mockRequest({ name: "", email: "bad", password: "short" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeTruthy();
  });

  it("returns 429 when rate limited", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 3_600_000 } as any);

    const res = await POST(mockRequest({ name: "A", email: "spam@b.com", password: "secret123" }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("too_many_requests");
  });

  it("returns 500 on a genuine server error", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    vi.mocked(prisma.user.create).mockRejectedValue(new Error("DB down"));

    const res = await POST(mockRequest({
      name: "Krishna",
      email: "k@example.com",
      password: "secret123",
    }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("server_error");
  });

  it("returns 409 when name matches the brand name", async () => {
    const res = await POST(mockRequest({
      name: "Sincere Bhakti",
      email: "spam@example.com",
      password: "secret123",
    }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("name_taken");
  });
});
