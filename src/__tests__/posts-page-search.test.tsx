import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const feed = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/IdentityProvider", () => ({ useIdentity: () => ({ activeChannelId: null, identities: [] }) }));
vi.mock("@/lib/hooks/useInfinitePosts", () => ({
  useInfinitePosts: (params: Record<string, unknown>) => {
    feed.calls.push(params);
    return { posts: [], setPosts: vi.fn(), loading: false, loadingMore: false, hasMore: false, sentinelRef: vi.fn() };
  },
}));
vi.mock("@/lib/hooks/useFeedCategories", () => ({ useFeedCategories: () => [] }));
vi.mock("@/components/PostCard", () => ({ default: () => null }));
vi.mock("@/components/CollapsibleComposer", () => ({ default: () => null }));
vi.mock("@/components/EditPostModal", () => ({ default: () => null }));
vi.mock("@/components/SignInPrompt", () => ({ default: () => null }));
vi.mock("@/components/PageHeader", () => ({ default: () => null }));

import PostsPageClient from "@/app/[locale]/posts/posts-page-client";

describe("PostsPageClient search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    feed.calls.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("debounces typed text into the public feed query", () => {
    const publicFeed = () => feed.calls.filter((c) => c.scope === "public").at(-1);
    render(<PostsPageClient />);
    expect(publicFeed()?.search).toBe("");

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  hare krishna " } });
    expect(publicFeed()?.search).toBe("");

    act(() => vi.advanceTimersByTime(300));
    expect(publicFeed()?.search).toBe("hare krishna");
    // The author's own tabs are searched with the same query.
    expect(feed.calls.filter((c) => c.scope !== "public").at(-1)?.search).toBe("hare krishna");
  });

  it("explains an empty search result", () => {
    render(<PostsPageClient />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyz" } });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("status")).toHaveTextContent("noResults");
  });
});
