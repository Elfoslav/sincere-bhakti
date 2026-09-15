import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("@/components/BlogEditor", async () => {
  const React = await import("react");
  return {
    default: function MockBlogEditor(props: any) {
      return React.createElement("textarea", {
        "aria-label": "mock-editor",
        value: props.initialContent ?? "",
        onChange: () => {},
        readOnly: true,
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
  excerpt: "Summary",
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

describe("BlogForm dirty tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(blog),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts clean and reports dirty after typing", () => {
    const onDirtyChange = vi.fn();
    render(
      <BlogForm
        mode="create"
        initialTitle="Title"
        initialExcerpt="Summary"
        onSuccess={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );

    expect(onDirtyChange).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Title changed" },
    });

    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  it("returns to clean after the changes are saved", async () => {
    const onDirtyChange = vi.fn();
    const onSuccess = vi.fn();
    render(
      <BlogForm
        mode="create"
        initialTitle="Title"
        initialExcerpt="Summary"
        onSuccess={onSuccess}
        onDirtyChange={onDirtyChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Title changed" },
    });
    expect(onDirtyChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "publish" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it("guards page unload while dirty and releases the guard after save", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const onSuccess = vi.fn();
    render(
      <BlogForm
        mode="create"
        initialTitle="Title"
        initialExcerpt="Summary"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Title changed" },
    });
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "publish" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    await waitFor(() =>
      expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function)),
    );
  });
});
