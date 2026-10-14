import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/services/album", () => ({ getCachedAlbumById: vi.fn(), getCachedAlbumByShortId: vi.fn() }));
vi.mock("@/lib/services/channel", () => ({ canAuthorChannel: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("not_found"); }),
  redirect: vi.fn(() => { throw new Error("redirect"); }),
}));
vi.mock("@/app/[locale]/gallery/[shortId]/album-detail-client", () => ({ default: () => null }));
vi.spyOn(console, "error").mockImplementation(() => {});

import AlbumPage from "@/app/[locale]/gallery/[shortId]/[[...slug]]/page";
import { getCachedAlbumById, getCachedAlbumByShortId } from "@/lib/services/album";
import { auth } from "@/lib/auth";
import { canAuthorChannel } from "@/lib/services/channel";
import { redirect } from "next/navigation";

const album = { id: "full-id", shortId: "1234abcd", slug: "secret-title", isPublic: false, language: "en", channel: { id: "channel-1" } };
const params = Promise.resolve({ locale: "en", shortId: "full-id" });

describe("legacy album links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedAlbumByShortId).mockResolvedValue(null);
    vi.mocked(getCachedAlbumById).mockResolvedValue(album as never);
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.mocked(canAuthorChannel).mockResolvedValue(false);
  });
  it("does not disclose a private slug to an anonymous viewer", async () => {
    await expect(AlbumPage({ params })).rejects.toThrow("not_found");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("does not disclose a private slug to a non-member", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "stranger" } } as never);
    await expect(AlbumPage({ params })).rejects.toThrow("not_found");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("redirects a channel author after authorization", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "owner" } } as never);
    vi.mocked(canAuthorChannel).mockResolvedValue(true);
    await expect(AlbumPage({ params })).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith("/gallery/1234abcd/secret-title");
  });
  it("redirects public legacy links for anonymous viewers", async () => {
    vi.mocked(getCachedAlbumById).mockResolvedValue({ ...album, isPublic: true } as never);
    await expect(AlbumPage({ params })).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith("/gallery/1234abcd/secret-title");
  });
});
