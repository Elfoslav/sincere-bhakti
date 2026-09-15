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
  isPublic: false,
  language: "en",
  publishedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
};

function renderEditPrivate(onSuccess: (...args: any[]) => void) {
  return render(
    <BlogForm
      mode="edit"
      postId="blog-1"
      initialTitle="My Article"
      initialSlug="my-article"
      initialExcerpt="Summary"
      initialIsPublic={false}
      onSuccess={onSuccess}
      onCancel={() => {}}
    />,
  );
}

describe("BlogForm private save buttons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(blog),
    });
  });

  it("shows the same Save & stay / Save & leave buttons in edit as in create", () => {
    const { unmount } = render(<BlogForm mode="create" onSuccess={vi.fn()} />);
    // Flip the public switch to private (first switch on the form).
    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(screen.getByRole("button", { name: "saveAndStay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "saveAndLeave" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "publish" })).not.toBeInTheDocument();
    unmount();

    renderEditPrivate(vi.fn());
    // Same pair of buttons — the text is reused, not repeated per mode.
    expect(screen.getByRole("button", { name: "saveAndStay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "saveAndLeave" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument();
  });

  it("reports stay (exit=false) on Save & stay in edit", async () => {
    const onSuccess = vi.fn();
    renderEditPrivate(onSuccess);

    fireEvent.click(screen.getByRole("button", { name: "saveAndStay" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(blog, false));
  });

  it("reports leave (exit=true) on Save & leave in edit", async () => {
    const onSuccess = vi.fn();
    renderEditPrivate(onSuccess);

    fireEvent.click(screen.getByRole("button", { name: "saveAndLeave" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(blog, true));
  });

  it("keeps Save + Cancel for public posts in edit", () => {
    render(
      <BlogForm
        mode="edit"
        postId="blog-1"
        initialTitle="My Article"
        initialExcerpt="Summary"
        initialIsPublic
        onSuccess={vi.fn()}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "saveAndStay" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "saveAndLeave" })).not.toBeInTheDocument();
  });
});
