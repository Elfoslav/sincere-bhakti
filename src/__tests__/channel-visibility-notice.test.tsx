import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, React.ReactNode>) => {
    const messages: Record<string, string> = {
      visibilityNoticeTitle: "Channel is not visible in all languages",
      visibilityNoticeBody: "This channel is currently only visible in some languages. Add a translation to make it appear in the other language listings: {languages}",
      visibilityNoticeAction: "Add translation",
      visibilityNoticeDismiss: "Dismiss",
    };
    const message = messages[key] ?? key;
    if (!values) return message;
    return message.split(/\{(\w+)\}/).map((part, i) => (i % 2 === 1 ? values[part] : part));
  }),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import ChannelVisibilityNotice from "@/app/[locale]/channels/[slug]/channel-visibility-notice";

const STORAGE_PREFIX = "channel-visibility-notice:";

describe("ChannelVisibilityNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders nothing when not shown", () => {
    const { container } = render(
      <ChannelVisibilityNotice
        channelId="ch-1"
        channelSlug="john"
        availableLanguages={["en"]}
        show={false}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the channel already has all translations", () => {
    const { container } = render(
      <ChannelVisibilityNotice
        channelId="ch-1"
        channelSlug="john"
        availableLanguages={["en", "cs", "sk"]}
        show={true}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders a hint listing the missing languages for a channel with a partial set", () => {
    render(
      <ChannelVisibilityNotice
        channelId="ch-1"
        channelSlug="john"
        availableLanguages={["en"]}
        show={true}
      />,
    );

    expect(screen.getByText("Channel is not visible in all languages")).toBeInTheDocument();
    expect(
      screen.getByText(/Add a translation to make it appear in the other language listings/),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content, element) =>
        element?.tagName === "SPAN" && content.includes("🇨🇿") && content.includes("🇸🇰")
          ? true
          : false,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add translation" })).toHaveAttribute(
      "href",
      "/channels/john/settings",
    );
  });

  it("hides on close and persists the dismissal for the channel", () => {
    render(
      <ChannelVisibilityNotice
        channelId="ch-1"
        channelSlug="john"
        availableLanguages={["en"]}
        show={true}
      />,
    );

    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Channel is not visible in all languages")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_PREFIX + "ch-1")).toBe("1");
  });

  it("stays hidden across renders once dismissed", () => {
    localStorage.setItem(STORAGE_PREFIX + "ch-1", "1");
    const { container } = render(
      <ChannelVisibilityNotice
        channelId="ch-1"
        channelSlug="john"
        availableLanguages={["en"]}
        show={true}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("tracks dismissal per channel", () => {
    localStorage.setItem(STORAGE_PREFIX + "ch-1", "1");
    const { container } = render(
      <ChannelVisibilityNotice
        channelId="ch-2"
        channelSlug="jane"
        availableLanguages={["en"]}
        show={true}
      />,
    );
    expect(container.innerHTML).not.toBe("");
  });
});
