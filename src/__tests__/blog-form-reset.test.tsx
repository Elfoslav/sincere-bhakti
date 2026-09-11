import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
// read at mount only, edits flow out via onChange.
vi.mock("@/components/BlogEditor", async () => {
  const React = await import("react");
  return {
    default: function MockBlogEditor(props: any) {
      const mounts = (globalThis as any).__editorMounts as (string | undefined)[];
      React.useEffect(() => {
        mounts.push(props.initialContent);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return React.createElement("textarea", {
        "aria-label": "mock-editor",
        value: props.initialContent ?? "",
        onChange: (e: any) =>
          props.onChange({
            contentJson: JSON.stringify({
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: e.target.value }] }],
            }),
            contentHtml: `<p>${e.target.value}</p>`,
            plainLength: e.target.value.length,
          }),
      });
    },
  };
});

vi.spyOn(console, "error").mockImplementation(() => {});

import BlogForm from "@/components/BlogForm";

const blog = {
  id: "blog-1",
  shortId: "abc12345",
  slug: "my-article",
  title: "My Article",
  excerpt: null,
  content: "{}",
  contentHtml: "<p>Hello</p>",
  coverUrl: null,
  isPublic: true,
  language: "en",
  publishedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
};

describe("BlogForm reset after publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__editorMounts = [];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(blog),
    });
  });

  it("clears the title field and remounts the editor empty", async () => {
    const onSuccess = vi.fn();
    render(<BlogForm mode="create" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "My Article" },
    });
    const editor = await screen.findByLabelText("mock-editor");
    fireEvent.change(editor, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "publish" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(blog));

    // Text inputs reset...
    expect(screen.getByPlaceholderText("titlePlaceholder")).toHaveValue("");
    // ...and the mount-once editor remounted with empty content (the remount
    // commits after the submit resolves, hence the wait).
    await waitFor(() => {
      const mounts = (globalThis as any).__editorMounts as (string | undefined)[];
      expect(mounts.length).toBeGreaterThan(1);
      expect(mounts[mounts.length - 1]).toBe("");
    });
  });
});
