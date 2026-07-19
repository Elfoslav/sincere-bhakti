import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/channel", () => ({
  getAuthorableChannels: vi.fn(),
}));
vi.mock("@/lib/csrf", () => ({
  validateOrigin: vi.fn(() => true),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { auth } from "@/lib/auth";
import { getAuthorableChannels } from "@/lib/services/channel";
import { validateOrigin } from "@/lib/csrf";
import { GET, PATCH } from "@/app/api/identity/route";
import { ACTIVE_IDENTITY_COOKIE } from "@/lib/active-identity";
import { CHANNEL_ROLE_OWNER } from "@/lib/channel-roles";
import type { AuthorableIdentity } from "@/types/identity";

const identities: AuthorableIdentity[] = [
  {
    id: "channel-1",
    name: "Personal",
    slug: "personal",
    avatarUrl: null,
    ownerId: "user-1",
    isPersonal: true,
    role: CHANNEL_ROLE_OWNER,
  },
  {
    id: "channel-2",
    name: "Kirtan Notes",
    slug: "kirtan-notes",
    avatarUrl: null,
    ownerId: "user-1",
    isPersonal: false,
    role: CHANNEL_ROLE_OWNER,
  },
];

function mockRequest(body?: unknown, cookieChannelId?: string) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
    cookies: {
      get: (name: string) => name === ACTIVE_IDENTITY_COOKIE && cookieChannelId
        ? { value: cookieChannelId }
        : undefined,
    },
  } as any;
}

describe("/api/identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateOrigin).mockReturnValue(true);
  });

  it("returns authorable identities and uses valid cookie as active identity", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(getAuthorableChannels).mockResolvedValue(identities);

    const res = await GET(mockRequest(undefined, "channel-2"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.activeChannelId).toBe("channel-2");
    expect(json.identities).toHaveLength(2);
  });

  it("falls back to session channel and refreshes cookie when cookie is invalid", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(getAuthorableChannels).mockResolvedValue(identities);

    const res = await GET(mockRequest(undefined, "missing-channel"));
    const json = await res.json();

    expect(json.activeChannelId).toBe("channel-1");
    expect(res.headers.get("set-cookie")).toContain(`${ACTIVE_IDENTITY_COOKIE}=channel-1`);
  });

  it("switches active identity when channel is authorable", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(getAuthorableChannels).mockResolvedValue(identities);

    const res = await PATCH(mockRequest({ channelId: "channel-2" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.activeChannelId).toBe("channel-2");
    expect(res.headers.get("set-cookie")).toContain(`${ACTIVE_IDENTITY_COOKIE}=channel-2`);
  });

  it("returns 404 when switching to a non-authorable channel", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", channelId: "channel-1" } } as any);
    vi.mocked(getAuthorableChannels).mockResolvedValue(identities);

    const res = await PATCH(mockRequest({ channelId: "channel-3" }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("identity_not_found");
  });

  it("returns 403 on invalid origin", async () => {
    vi.mocked(validateOrigin).mockReturnValue(false);

    const res = await PATCH(mockRequest({ channelId: "channel-2" }));

    expect(res.status).toBe(403);
    expect(auth).not.toHaveBeenCalled();
  });
});
