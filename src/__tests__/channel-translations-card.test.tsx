import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>{children}</a>
  ),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

vi.mock("@/i18n/routing", () => ({
  locales: ["en", "cs", "sk"],
  localeFlags: { en: "🇬🇧", cs: "🇨🇿", sk: "🇸🇰" },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import ChannelTranslationsCard from "@/app/[locale]/channels/[slug]/settings/channel-translations-card";

const translation = {
  id: "trans-1",
  language: "en",
  name: "Krishna Das",
  slug: "krishna-das",
  renameCount: 0,
};

describe("ChannelTranslationsCard personal channel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides add/edit and explains profile ownership instead of failing on save", () => {
    render(
      <ChannelTranslationsCard
        translations={[translation]}
        channelSlug="krishna-das"
        isPersonal
      />,
    );

    expect(screen.getByText("personalTranslationsNote")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "addTranslation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editTranslation" })).not.toBeInTheDocument();
  });

  it("still offers add/edit for regular channels", () => {
    render(
      <ChannelTranslationsCard
        translations={[translation]}
        channelSlug="krishna-das"
        isPersonal={false}
      />,
    );

    expect(screen.queryByText("personalTranslationsNote")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "addTranslation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "editTranslation" })).toBeInTheDocument();
  });
});
