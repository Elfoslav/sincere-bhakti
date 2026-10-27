import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Album } from "@/types/album";

const feed = vi.hoisted(() => ({ mine: [] as Album[], sentinel: vi.fn(), hasMore: true }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { user: { id: "owner" } } }) }));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/components/IdentityProvider", () => ({ useIdentity: () => ({ activeChannelId: "channel-1", identities: [] }) }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => "/posts", Link: () => null }));
vi.mock("@/components/AlbumForm", () => ({ default: () => null }));
vi.mock("@/components/AlbumCard", () => ({ default: ({ album }: { album: Album }) => <p>{album.title}</p> }));
vi.mock("@/lib/hooks/useInfiniteAlbums", () => ({ useInfiniteAlbums: (params: { scope?: string }) => ({
  posts: params.scope ? [] : feed.mine, setPosts: vi.fn(), loading: false,
  loadingMore: false, hasMore: params.scope ? false : feed.hasMore,
  sentinelRef: params.scope ? vi.fn() : feed.sentinel,
}) }));
vi.spyOn(console, "error").mockImplementation(() => {});
import GalleryPageClient from "@/app/[locale]/gallery/gallery-page-client";

describe("gallery personal-tab pagination", () => {
  beforeEach(() => { vi.clearAllMocks(); feed.hasMore = true; });
  it.each([
    { isPublic: true, tab: "myPrivateTab", empty: "emptyMyPrivate" },
    { isPublic: false, tab: "myPublicTab", empty: "emptyMyPublic" },
  ])("keeps the sentinel mounted when the loaded page has opposite visibility ($tab)", ({ isPublic, tab, empty }) => {
    feed.mine = [{ id: "album-1", title: "Opposite visibility", isPublic } as Album];
    render(<GalleryPageClient />);
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    expect(screen.getByText(empty)).toBeVisible();
    expect(feed.sentinel.mock.calls.some(([node]) => node instanceof HTMLElement)).toBe(true);
  });
});
