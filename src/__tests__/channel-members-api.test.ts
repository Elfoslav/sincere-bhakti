import { describe, it, expect, vi, beforeEach } from "vitest";
import { CHANNEL_MEMBER_ACTION_ADD, CHANNEL_MEMBER_ACTION_EDIT, CHANNEL_ROLE_ADMIN, CHANNEL_ROLE_EDITOR } from "@/lib/channel-roles";
import {
  ERROR_CANNOT_ADD_CHANNEL_OWNER,
  ERROR_CHANNEL_MEMBER_EXISTS,
  ERROR_FORBIDDEN,
  ERROR_NOT_FOUND,
  ERROR_TOO_MANY_REQUESTS,
  ERROR_USER_NOT_FOUND,
} from "@/lib/error-messages";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMIT_PREFIX: {
    readChannelMembers: "read-channel-members",
    updateChannelMembers: "update-channel-members",
  },
  RATE_LIMITS: {
    readChannelMembers: { limit: 60, windowMs: 60_000 },
    updateChannelMembers: { limit: 30, windowMs: 3_600_000 },
  },
  checkRateLimit: vi.fn(async () => true),
}));
vi.mock("@/lib/services/channel", () => {
  class NotFoundError extends Error {
    name = "NotFoundError" as const;
  }
  class UserNotFoundError extends Error {
    name = "UserNotFoundError" as const;
  }
  class CannotAddChannelOwnerError extends Error {
    name = "CannotAddChannelOwnerError" as const;
  }

  return {
    NotFoundError,
    UserNotFoundError,
    CannotAddChannelOwnerError,
    ChannelMemberAlreadyExistsError: class ChannelMemberAlreadyExistsError extends Error {
      name = "ChannelMemberAlreadyExistsError" as const;
    },
    getChannelSettingsBySlug: vi.fn(),
    addChannelMemberByEmail: vi.fn(),
    updateChannelMemberByEmail: vi.fn(),
  };
});

vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  ChannelMemberAlreadyExistsError,
  CannotAddChannelOwnerError,
  UserNotFoundError,
  addChannelMemberByEmail,
  getChannelSettingsBySlug,
  updateChannelMemberByEmail,
} from "@/lib/services/channel";
import { GET, POST } from "@/app/api/channels/[slug]/members/route";

const params = { params: Promise.resolve({ slug: "my-channel" }) };
const settings = {
  channel: {
    id: "ch-1",
    name: "My Channel",
    slug: "my-channel",
    avatarUrl: null,
    ownerId: "owner-1",
    ownerName: "Owner",
    ownerEmail: "owner@example.com",
  },
  members: [
    {
      id: "admin-1",
      name: "Admin",
      email: "admin@example.com",
      image: null,
      role: CHANNEL_ROLE_ADMIN,
    },
  ],
};

function mockRequest(body?: unknown): any {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
  };
}

describe("GET /api/channels/[slug]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateOrigin).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(true);
  });

  it("returns members for a permitted owner or admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as any);
    vi.mocked(getChannelSettingsBySlug).mockResolvedValue(settings as any);

    const res = await GET(mockRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.members).toEqual(settings.members);
    expect(getChannelSettingsBySlug).toHaveBeenCalledWith("my-channel", "owner-1");
  });

  it("returns 403 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as never);

    const res = await GET(mockRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe(ERROR_FORBIDDEN);
  });

  it("returns 404 when service hides the channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "editor-1" } } as any);
    vi.mocked(getChannelSettingsBySlug).mockResolvedValue(null);

    const res = await GET(mockRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe(ERROR_NOT_FOUND);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as any);
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await GET(mockRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe(ERROR_TOO_MANY_REQUESTS);
  });
});

describe("POST /api/channels/[slug]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateOrigin).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(true);
  });

  it("adds a channel member after validation", async () => {
    const member = {
      id: "editor-1",
      name: "Editor",
      email: "editor@example.com",
      image: null,
      role: CHANNEL_ROLE_EDITOR,
    };
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as any);
    vi.mocked(getChannelSettingsBySlug).mockResolvedValue(settings as any);
    vi.mocked(addChannelMemberByEmail).mockResolvedValue(member as any);

    const res = await POST(mockRequest({ action: CHANNEL_MEMBER_ACTION_ADD, email: " Editor@Example.com ", role: CHANNEL_ROLE_EDITOR }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.member).toEqual(member);
    expect(addChannelMemberByEmail).toHaveBeenCalledWith({
      channelId: "ch-1",
      email: "editor@example.com",
      role: CHANNEL_ROLE_EDITOR,
      actorUserId: "owner-1",
    });
    expect(updateChannelMemberByEmail).not.toHaveBeenCalled();
  });

  it("updates a channel member when edit action is requested", async () => {
    const member = {
      id: "editor-1",
      name: "Editor",
      email: "editor@example.com",
      image: null,
      role: CHANNEL_ROLE_ADMIN,
    };
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as any);
    vi.mocked(getChannelSettingsBySlug).mockResolvedValue(settings as any);
    vi.mocked(updateChannelMemberByEmail).mockResolvedValue(member as any);

    const res = await POST(mockRequest({ action: CHANNEL_MEMBER_ACTION_EDIT, email: "editor@example.com", role: CHANNEL_ROLE_ADMIN }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.member).toEqual(member);
    expect(updateChannelMemberByEmail).toHaveBeenCalledWith({
      channelId: "ch-1",
      email: "editor@example.com",
      role: CHANNEL_ROLE_ADMIN,
      actorUserId: "owner-1",
    });
    expect(addChannelMemberByEmail).not.toHaveBeenCalled();
  });

  it("returns 403 before auth when origin is invalid", async () => {
    vi.mocked(validateOrigin).mockReturnValue(false);

    const res = await POST(mockRequest({ action: CHANNEL_MEMBER_ACTION_ADD, email: "editor@example.com", role: CHANNEL_ROLE_EDITOR }), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe(ERROR_FORBIDDEN);
    expect(auth).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as any);

    const res = await POST(mockRequest({ action: CHANNEL_MEMBER_ACTION_ADD, email: "editor@example.com", role: "viewer" }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("validation_error:role");
    expect(addChannelMemberByEmail).not.toHaveBeenCalled();
  });

  it("returns 404 when the actor cannot manage settings", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "editor-1" } } as any);
    vi.mocked(getChannelSettingsBySlug).mockResolvedValue(null);

    const res = await POST(mockRequest({ action: CHANNEL_MEMBER_ACTION_ADD, email: "admin@example.com", role: CHANNEL_ROLE_ADMIN }), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe(ERROR_NOT_FOUND);
    expect(addChannelMemberByEmail).not.toHaveBeenCalled();
  });

  it("returns 404 when the target email does not belong to a user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as any);
    vi.mocked(getChannelSettingsBySlug).mockResolvedValue(settings as any);
    vi.mocked(addChannelMemberByEmail).mockRejectedValue(new UserNotFoundError());

    const res = await POST(mockRequest({ action: CHANNEL_MEMBER_ACTION_ADD, email: "missing@example.com", role: CHANNEL_ROLE_EDITOR }), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe(ERROR_USER_NOT_FOUND);
  });

  it("returns 400 when the target email belongs to the channel owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as any);
    vi.mocked(getChannelSettingsBySlug).mockResolvedValue(settings as any);
    vi.mocked(addChannelMemberByEmail).mockRejectedValue(new CannotAddChannelOwnerError());

    const res = await POST(mockRequest({ action: CHANNEL_MEMBER_ACTION_ADD, email: "owner@example.com", role: CHANNEL_ROLE_ADMIN }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe(ERROR_CANNOT_ADD_CHANNEL_OWNER);
  });

  it("returns 409 when adding an existing member", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner-1" } } as any);
    vi.mocked(getChannelSettingsBySlug).mockResolvedValue(settings as any);
    vi.mocked(addChannelMemberByEmail).mockRejectedValue(new ChannelMemberAlreadyExistsError());

    const res = await POST(mockRequest({ action: CHANNEL_MEMBER_ACTION_ADD, email: "admin@example.com", role: CHANNEL_ROLE_ADMIN }), params);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe(ERROR_CHANNEL_MEMBER_EXISTS);
  });
});
