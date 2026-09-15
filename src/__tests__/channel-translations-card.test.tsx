import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

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

const english = { id: "trans-en", language: "en", name: "Krishna Das", slug: "krishna-das", renameCount: 0 };
const czech = { id: "trans-cs", language: "cs", name: "Krišna Dás", slug: "krisna-das", renameCount: 0 };

function rowFor(name: string) {
  return screen.getByText(name).closest("div.flex.items-center")!;
}

describe("ChannelTranslationsCard personal channel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks the default translation but allows other languages", () => {
    render(
      <ChannelTranslationsCard
        translations={[english, czech]}
        channelSlug="krishna-das"
        isPersonal
        defaultLanguage="en"
      />,
    );

    expect(screen.getByText("personalTranslationsNote")).toBeInTheDocument();
    // Default row: buttons stay visible but disabled (profile-owned).
    const defaultRow = rowFor("Krishna Das");
    expect(within(defaultRow).getByRole("button", { name: "editTranslation" })).toBeDisabled();
    expect(within(defaultRow).getByRole("button", { name: "deleteTranslation" })).toBeDisabled();
    // Other languages stay manageable, and adding is offered.
    const czechRow = rowFor("Krišna Dás");
    expect(within(czechRow).getByRole("button", { name: "editTranslation" })).not.toBeDisabled();
    expect(within(czechRow).getByRole("button", { name: "deleteTranslation" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "addTranslation" })).toBeInTheDocument();
  });

  it("still offers add/edit for regular channels", () => {
    render(
      <ChannelTranslationsCard
        translations={[english]}
        channelSlug="krishna-das"
        isPersonal={false}
        defaultLanguage="en"
      />,
    );

    expect(screen.queryByText("personalTranslationsNote")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "addTranslation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "editTranslation" })).toBeInTheDocument();
  });
});
