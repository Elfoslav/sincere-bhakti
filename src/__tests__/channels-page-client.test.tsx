import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string, _values?: Record<string, string | number>) => {
    const messages: Record<string, string> = {
      title: "All Channels",
      searchPlaceholder: "Search channels by name...",
      noChannels: "No channels found.",
      loadError: "Failed to load channels. Please try again.",
      retry: "Retry",
      postCount: "{count} posts",
      loading: "Loading channels...",
      loadMore: "Load more",
    };
    return messages[key] ?? key;
  }),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import ChannelsPageClient from "@/app/[locale]/channels/channels-page-client";

describe("ChannelsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error state when API call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    render(<ChannelsPageClient />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load channels. Please try again.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
  });

  it("keeps long channel names inside the grid (grid item clamps min-width)", async () => {
    const longName = `${"Very Long Channel Name ".repeat(10)}${"A".repeat(120)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({
        items: [{ id: "1", name: longName, slug: "long", avatarUrl: null, postCount: 1 }],
        nextCursor: null,
      })),
    );

    const { container } = render(<ChannelsPageClient />);

    await waitFor(() => {
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    // jsdom does no layout, so assert the clamping contract directly: the
    // grid item (the channel link) must allow shrinking below content width
    // (grid items default to min-width:auto, which sizes the track to the
    // longest name), and the name itself must truncate instead of growing.
    const link = container.querySelector('a[href="/channels/long"]');
    expect(link?.className).toMatch(/(^|\s)min-w-0($|\s)/);
    expect(screen.getByText(longName).className).toMatch(/(^|\s)truncate($|\s)/);
  });
});
