import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: "user-1", emailVerifiedAt: "2026-01-01T00:00:00.000Z" } },
    status: "authenticated",
  })),
  signOut: vi.fn(),
}));

vi.mock("@/components/IdentityProvider", () => ({
  useIdentity: vi.fn(() => ({ activeChannelId: "channel-1" })),
}));

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

// Pass-through dynamic() so the (mocked) editor below loads asynchronously
// like the real code-split import.
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<any>) => {
      function DynamicStub(props: any) {
        const [Comp, setComp] = React.useState<any>(null);
        React.useEffect(() => {
          let live = true;
          loader().then((m: any) => {
            if (live) setComp(() => m.default);
          });
          return () => {
            live = false;
          };
        }, []);
        return Comp ? React.createElement(Comp, props) : null;
      }
      return DynamicStub;
    },
  };
});

// Mount-once stand-in mirroring the real editor contract: initialContent is
// read at mount only.
vi.mock("@/components/BlogEditor", () => ({
  default: function MockBlogEditor(props: any) {
    return (
      <textarea
        aria-label="mock-editor"
        value={props.initialContent ?? ""}
        onChange={() => {}}
        readOnly
      />
    );
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import EditBlogModal from "@/components/EditBlogModal";
import type { BlogPost } from "@/types/blog";

const FULL_BODY = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Full article body" }] }],
});

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    id: "blog-1",
    shortId: "shortid1",
    slug: "my-article",
    title: "My Article",
    excerpt: "Summary",
    content: FULL_BODY,
    contentHtml: "<p>Full article body</p>",
    coverUrl: null,
    isPublic: true,
    language: "en",
    publishedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    channel: { id: "channel-1", name: "Channel", slug: "channel", avatarUrl: null, ownerId: "user-1" },
    categories: [],
    ...overrides,
  };
}

describe("EditBlogModal article body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ posts: [] }) });
  });

  it("initializes the editor directly when the body is present (no fetch)", async () => {
    render(<EditBlogModal post={makePost()} open onOpenChange={() => {}} onSuccess={() => {}} />);

    const editor = await screen.findByLabelText("mock-editor");
    expect(editor).toHaveValue(FULL_BODY);
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/blog-posts/blog-1"),
      expect.anything(),
    );
  });

  it("fetches the full article when the list projection omits the body", async () => {
    vi.mocked(global.fetch).mockImplementation((url: any) => {
      if (String(url).includes("/api/blog-posts/blog-1")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(makePost()) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ posts: [] }) } as Response);
    });

    render(
      <EditBlogModal post={makePost({ content: null })} open onOpenChange={() => {}} onSuccess={() => {}} />,
    );

    const editor = await screen.findByLabelText("mock-editor");
    await waitFor(() => expect(editor).toHaveValue(FULL_BODY));
    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith("/api/blog-posts/blog-1");
  });

  it("shows an error instead of an empty editor when the body cannot load", async () => {
    vi.mocked(global.fetch).mockImplementation((url: any) => {
      if (String(url).includes("/api/blog-posts/blog-1")) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ posts: [] }) } as Response);
    });

    render(
      <EditBlogModal post={makePost({ content: null })} open onOpenChange={() => {}} onSuccess={() => {}} />,
    );

    await screen.findByRole("alert");
    expect(screen.queryByLabelText("mock-editor")).not.toBeInTheDocument();
  });
});
