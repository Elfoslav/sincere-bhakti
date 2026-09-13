import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BlogPost } from "@/types/blog";
import type { ChannelWithPostCount } from "@/types/channel";

const sessionState = vi.hoisted(() => ({ userId: null as string | null }));
const blogState = vi.hoisted(() => ({ posts: [] as BlogPost[], loading: false }));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => sessionState.userId
    ? { data: { user: { id: sessionState.userId } }, status: "authenticated" }
    : { data: null, status: "unauthenticated" }),
}));

vi.mock("@/components/IdentityProvider", () => ({
  useIdentity: vi.fn(() => ({ identities: [], refreshIdentities: vi.fn() })),
}));

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>{children}</a>
  ),
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

vi.mock("@/lib/hooks/useInfinitePosts", () => ({
  useInfinitePosts: vi.fn(() => ({
    posts: [],
    setPosts: vi.fn(),
    loading: false,
    loadingMore: false,
    hasMore: false,
    sentinelRef: vi.fn(),
  })),
}));

vi.mock("@/lib/hooks/useInfiniteBlogPosts", () => ({
  useInfiniteBlogPosts: vi.fn(() => ({
    posts: blogState.posts,
    setPosts: vi.fn(),
    loading: blogState.loading,
    loadingMore: false,
    hasMore: false,
    sentinelRef: vi.fn(),
  })),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import ChannelPageClient from "@/app/[locale]/channels/[slug]/channel-page-client";

const channel: ChannelWithPostCount = {
  id: "channel-1",
  name: "Test Channel",
  slug: "test-channel",
  avatarUrl: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  ownerId: "owner-1",
  ownerName: "Owner",
  postCount: 0,
  isPersonal: false,
  renameCount: 0,
  defaultLanguage: "en",
  availableLanguages: ["en"],
};

function blogPost(): BlogPost {
  return {
    id: "blog-1",
    shortId: "abc12345",
    slug: "my-article",
    title: "My Article",
    excerpt: "Summary",
    content: "Body",
    contentHtml: "<p>Body</p>",
    coverUrl: null,
    isPublic: true,
    language: "en",
    publishedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    channel: { id: "channel-1", name: "Test Channel", slug: "test-channel", avatarUrl: null, ownerId: "owner-1" },
    categories: [],
  };
}

describe("ChannelPageClient blog section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.userId = null;
    blogState.posts = [];
    blogState.loading = false;
  });

  it("hides the whole blog section for visitors when the channel has no articles", () => {
    render(<ChannelPageClient channel={channel} />);

    expect(screen.queryByRole("heading", { name: "title" })).toBeNull();
    expect(screen.queryByText("emptyPublic")).toBeNull();
  });

  it("shows the empty blog section to the channel owner", () => {
    sessionState.userId = "owner-1";

    render(<ChannelPageClient channel={channel} />);

    expect(screen.getByRole("heading", { name: "title" })).toBeInTheDocument();
    expect(screen.getByText("emptyPublic")).toBeInTheDocument();
  });

  it("shows articles to visitors when the channel has them", () => {
    blogState.posts = [blogPost()];

    render(<ChannelPageClient channel={channel} />);

    expect(screen.getByRole("heading", { name: "title" })).toBeInTheDocument();
    expect(screen.getByText("My Article")).toBeInTheDocument();
  });

  it("shows loading skeletons while articles are being fetched", () => {
    blogState.loading = true;

    render(<ChannelPageClient channel={channel} />);

    expect(screen.getByRole("heading", { name: "title" })).toBeInTheDocument();
  });
});
