import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Album } from "@/types/album";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), Link: () => null }));
vi.mock("next/image", () => ({ default: () => <span /> }));
vi.mock("@/components/IdentityProvider", () => ({ useIdentity: () => ({ identities: [] }) }));
vi.mock("@/components/AlbumActions", () => ({ default: () => null }));
vi.mock("@/components/AlbumForm", () => ({ default: () => null }));

import AlbumDetailClient from "@/app/[locale]/gallery/[shortId]/album-detail-client";

const album: Album = {
  id: "album-review", shortId: "1234abcd", slug: "album-review", title: "A community album",
  description: "Shared moments", coverUrl: null, itemCount: 3, isPublic: true, language: "en",
  createdAt: "2026-10-25T10:00:00Z", updatedAt: "2026-10-25T10:00:00Z",
  channel: { id: "channel-review", name: "Community", slug: "community", ownerId: "owner-review", avatarUrl: null },
  items: [
    { url: "/video.mp4", type: "video", position: 0, width: 800, height: 600 },
    { url: "/first.jpg", type: "image", position: 1, width: 800, height: 600 },
    { url: "/second.jpg", type: "image", position: 2, width: 800, height: 600 },
  ],
};

it("keeps album identity and media together in the shared reading layout", () => {
  render(<AlbumDetailClient album={album} />);
  expect(screen.getByRole("heading", { level: 1, name: album.title }).closest(".reading-container")).not.toBeNull();
  expect(screen.getByText(album.description!)).toBeVisible();
  expect(screen.getAllByRole("button", { name: "openImage" })).toHaveLength(2);
});

it("opens the selected image from mixed media and closes the viewer with Escape", () => {
  render(<AlbumDetailClient album={album} />);
  fireEvent.click(screen.getAllByRole("button", { name: "openImage" })[1]);
  expect(screen.getByRole("dialog").querySelector("img")).toHaveAttribute("src", "/second.jpg");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("expands an album video into the shared closable viewer", () => {
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  render(<AlbumDetailClient album={album} />);
  fireEvent.click(screen.getByRole("button", { name: "expandVideo" }));
  expect(screen.getByRole("dialog").querySelector("video")).toHaveAttribute("src", "/video.mp4");
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  pause.mockRestore();
});
