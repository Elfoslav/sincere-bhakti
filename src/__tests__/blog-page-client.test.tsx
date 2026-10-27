import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({ status: "authenticated", data: { user: { id: "u" } } as { user: { id: string } } | null }));
vi.mock("next-auth/react", () => ({ useSession: () => session }));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => "/posts", Link: () => null }));
vi.mock("@/components/IdentityProvider", () => ({ useIdentity: () => ({ activeChannelId: "c", identities: [{ id: "c", name: "Community" }] }) }));
vi.mock("@/lib/hooks/useFeedSearch", () => ({ useFeedSearch: () => ({ searchInput: "", setSearchInput: vi.fn(), search: "" }) }));
vi.mock("@/lib/hooks/useFeedCategories", () => ({ useFeedCategories: () => [] }));
vi.mock("@/lib/hooks/useInfiniteBlogPosts", () => ({ useInfiniteBlogPosts: () => ({ posts: [], setPosts: vi.fn(), loading: false, loadingMore: false, hasMore: false, sentinelRef: vi.fn() }) }));
vi.mock("@/components/EditBlogModal", () => ({ default: () => null }));
vi.mock("@/components/BlogForm", () => ({ default: ({ onCancel }: { onCancel: () => void }) => <div role="form"><button onClick={onCancel}>Cancel editor</button></div> }));
import BlogPageClient from "@/app/[locale]/blog/blog-page-client";

describe("BlogPageClient publishing tools", () => {
  beforeEach(() => { session.status = "authenticated"; session.data = { user: { id: "u" } }; });
  it("opens the editor only on request and preserves it through transient session changes", () => {
    const { rerender } = render(<BlogPageClient />);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "newarticle" }));
    expect(screen.getByRole("form")).toBeVisible();
    session.data = null;
    rerender(<BlogPageClient />);
    expect(screen.getByRole("form")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel editor" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
  it("keeps publishing tools out of the guest feed", () => {
    session.status = "unauthenticated"; session.data = null;
    render(<BlogPageClient />);
    expect(screen.queryByRole("button", { name: "newarticle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
