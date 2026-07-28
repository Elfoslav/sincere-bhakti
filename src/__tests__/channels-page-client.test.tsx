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
});
