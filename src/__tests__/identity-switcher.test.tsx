import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_ROLE_OWNER } from "@/lib/channel-roles";
import type { AuthorableIdentity } from "@/types/identity";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/components/IdentityProvider", () => ({ useIdentity: vi.fn() }));
vi.spyOn(console, "error").mockImplementation(() => {});

import IdentitySwitcher from "@/components/IdentitySwitcher";
import { useIdentity } from "@/components/IdentityProvider";

const personal: AuthorableIdentity = { id: "personal", name: "Madhava Dasa", slug: "madhava", avatarUrl: null, ownerId: "user", isPersonal: true, role: CHANNEL_ROLE_OWNER };
const channel: AuthorableIdentity = { ...personal, id: "channel", name: "Vrindavan Community", slug: "vrindavan", isPersonal: false, avatarUrl: "/images/article-tulsi.jpg" };
const switchIdentity = vi.fn();

beforeEach(() => {
  switchIdentity.mockReset().mockResolvedValue(undefined);
  vi.mocked(useIdentity).mockReturnValue({ identities: [personal, channel], activeIdentity: personal, activeChannelId: personal.id, switchIdentity, loading: false, refreshIdentities: vi.fn() });
});

describe("IdentitySwitcher", () => {
  it("shows the active name and a shared avatar with a quiet desktop label", () => {
    render(<IdentitySwitcher />);
    const trigger = screen.getByRole("button", { name: "switchLabel: Madhava Dasa" });
    expect(trigger).toHaveTextContent("activeLabel");
    expect(trigger).toHaveTextContent(personal.name);
    expect(trigger).toHaveTextContent("M");
  });

  it("keeps the mobile name concise and uses the real avatar", () => {
    vi.mocked(useIdentity).mockReturnValue({ ...useIdentity(), activeIdentity: channel });
    render(<IdentitySwitcher mobileNav />);
    const trigger = screen.getByRole("button", { name: `switchLabel: ${channel.name}` });
    expect(trigger).not.toHaveTextContent("activeLabel");
    expect(trigger.querySelector("img")).toHaveAttribute("src", channel.avatarUrl);
  });

  it("marks the selected identity and links to channel management", async () => {
    render(<IdentitySwitcher />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("menuitemradio", { name: /Madhava Dasa/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: /Vrindavan Community/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitem", { name: "manage" })).toHaveAttribute("href", "/profile");
  });

  it("waits for switching to succeed before closing", async () => {
    let complete!: () => void;
    switchIdentity.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    render(<IdentitySwitcher />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Vrindavan Community/ }));
    expect(switchIdentity).toHaveBeenCalledWith(channel.id);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await act(async () => complete());
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("preserves the selection and leaves the menu available after a failed switch", async () => {
    switchIdentity.mockRejectedValueOnce(new Error("failed"));
    render(<IdentitySwitcher />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Vrindavan Community/ }));
    await waitFor(() => expect(switchIdentity).toHaveBeenCalledOnce());
    expect(screen.getByRole("menuitemradio", { name: /Madhava Dasa/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes the selected identity without sending a redundant request", async () => {
    render(<IdentitySwitcher />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Madhava Dasa/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(switchIdentity).not.toHaveBeenCalled();
  });

  it("shows a noninteractive placeholder before identity data arrives", () => {
    vi.mocked(useIdentity).mockReturnValue({ ...useIdentity(), activeIdentity: null, identities: [] });
    const { container } = render(<IdentitySwitcher />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
