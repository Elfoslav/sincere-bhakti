import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const feed = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  session: null as unknown,
  onCreate: null as null | ((post: unknown) => void),
  setPosts: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: feed.session }) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/IdentityProvider", () => ({ useIdentity: () => ({ activeChannelId: "channel-1", identities: [] }) }));
vi.mock("@/lib/hooks/useInfinitePosts", () => ({
  useInfinitePosts: (params: Record<string, unknown>) => {
    feed.calls.push(params);
    const setPosts = vi.fn();
    feed.setPosts.push(setPosts);
    return { posts: [], setPosts, loading: false, loadingMore: false, hasMore: false, sentinelRef: vi.fn() };
  },
}));
vi.mock("@/lib/hooks/useFeedCategories", () => ({ useFeedCategories: () => [] }));
vi.mock("@/components/PostCard", () => ({ default: () => null }));
vi.mock("@/components/CollapsibleComposer", () => ({
  default: ({ onSuccess }: { onSuccess: (post: unknown) => void }) => {
    feed.onCreate = onSuccess;
    return null;
  },
}));
vi.mock("@/components/EditPostModal", () => ({ default: () => null }));
vi.mock("@/components/SignInPrompt", () => ({ default: () => null }));
vi.mock("@/components/PageHeader", () => ({ default: () => null }));

import PostsPageClient from "@/app/[locale]/posts/posts-page-client";

describe("PostsPageClient search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    feed.calls.length = 0;
    feed.setPosts.length = 0;
    feed.session = null;
    feed.onCreate = null;
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

  it("hides the My posts tab counts while a search is active", () => {
    feed.session = { user: { id: "u1" } };
    render(<PostsPageClient />);
    expect(screen.getByRole("tab", { name: "myPublicTab (0)" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "hare" } });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tab", { name: "myPublicTab" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "myPrivateTab" })).toBeInTheDocument();
  });

  it("only prepends a new post to the feed when it matches the active search", () => {
    feed.session = { user: { id: "u1" } };
    render(<PostsPageClient />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "kirtan" } });
    act(() => vi.advanceTimersByTime(300));
    feed.setPosts.forEach((fn) => fn.mockClear());

    act(() => feed.onCreate!({ id: "p1", content: "Good morning", isPublic: true, categories: [] }));
    expect(feed.setPosts.every((fn) => fn.mock.calls.length === 0)).toBe(true);

    act(() => feed.onCreate!({ id: "p2", content: "Evening KIRTAN tonight", isPublic: true, categories: [] }));
    expect(feed.setPosts.some((fn) => fn.mock.calls.length > 0)).toBe(true);
  });
});
