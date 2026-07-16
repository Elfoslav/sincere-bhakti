import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IdentityProvider, useIdentity } from "@/components/IdentityProvider";

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
}));

const identities = [
  {
    id: "channel-1",
    name: "Personal",
    slug: "personal",
    avatarUrl: null,
    ownerId: "user-1",
    isPersonal: true,
    role: "owner",
  },
  {
    id: "channel-2",
    name: "Kirtan",
    slug: "kirtan",
    avatarUrl: null,
    ownerId: "user-1",
    isPersonal: false,
    role: "owner",
  },
] as const;

function wrapper({ children }: { children: React.ReactNode }) {
  return <IdentityProvider>{children}</IdentityProvider>;
}

describe("IdentityProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue({
      data: { user: { id: "user-1" } },
      status: "authenticated",
    });
  });

  it("rolls back optimistic identity when switching request rejects", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        activeChannelId: "channel-1",
        identities,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockRejectedValueOnce(new Error("network_error"));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useIdentity(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeChannelId).toBe("channel-1");
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.switchIdentity("channel-2");
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect(result.current.activeChannelId).toBe("channel-1");
    expect(result.current.activeIdentity?.id).toBe("channel-1");
  });
});
