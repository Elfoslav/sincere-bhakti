import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_ROLE_OWNER } from "@/lib/channel-roles";
import type { AuthorableIdentity } from "@/types/identity";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "user", emailVerifiedAt: "2026-01-01" } } }) }));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/components/IdentityProvider", () => ({ useIdentity: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PostForm from "@/components/PostForm";
import { useIdentity } from "@/components/IdentityProvider";

const personal: AuthorableIdentity = { id: "personal", name: "Personal name", slug: "personal", ownerId: "user", avatarUrl: null, isPersonal: true, role: CHANNEL_ROLE_OWNER };
const community: AuthorableIdentity = { ...personal, id: "community", name: "Community", slug: "community", isPersonal: false };

beforeEach(() => {
  vi.mocked(useIdentity).mockReturnValue({ identities: [personal, community], activeChannelId: personal.id, activeIdentity: personal, loading: false, switchIdentity: vi.fn().mockResolvedValue(undefined), refreshIdentities: vi.fn() });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "post", shortId: "post1234", slug: "reflection", isPublic: true, media: [] }) }));
});

describe("PostForm posting identity", () => {
  it("switches away from the channel-page default without losing text and submits the chosen channel", async () => {
    const onSuccess = vi.fn();
    render(<PostForm mode="create" postingChannel={community} onSuccess={onSuccess} />);
    const text = screen.getByRole("textbox", { name: "composePlaceholder" });
    fireEvent.change(text, { target: { value: "A reflection to preserve" } });
    fireEvent.click(screen.getByRole("button", { name: "switchLabel: Community" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Personal name/ }));
    await screen.findByRole("button", { name: "switchLabel: Personal name" });
    expect(text).toHaveValue("A reflection to preserve");
    fireEvent.click(screen.getByRole("button", { name: "publish" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith("/api/posts", expect.objectContaining({ body: expect.stringContaining('"channelId":"personal"') }));
  });

  it("blocks both button and form submission while an identity switch is pending", () => {
    vi.mocked(useIdentity).mockReturnValue({ ...useIdentity(), loading: true });
    const { container } = render(<PostForm mode="create" initialContent="A reflection" onSuccess={vi.fn()} />);
    expect(screen.getByRole("button", { name: "publish" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps editing an existing post free of identity reassignment controls", () => {
    render(<PostForm mode="edit" postId="post" initialContent="A reflection" onSuccess={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /switchLabel/ })).not.toBeInTheDocument();
  });
});
