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
import { BLOG_TITLE_MAX_LENGTH, BLOG_SLUG_MAX_LENGTH } from "@/lib/validation";

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

describe("BlogForm slug field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(blog),
    });
  });

  it("renders the slug input disabled by default below the title", () => {
    render(<BlogForm mode="create" onSuccess={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText("titlePlaceholder");
    const slugInput = screen.getByPlaceholderText("slugPlaceholder") as HTMLInputElement;

    expect(slugInput).toBeDisabled();
    // Below the title: title precedes slug in document order.
    expect(titleInput.compareDocumentPosition(slugInput)).toBe(
      titleInput.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("appends the enable button to the slug input", () => {
    render(<BlogForm mode="create" onSuccess={vi.fn()} />);

    const slugInput = screen.getByPlaceholderText("slugPlaceholder");
    const toggle = screen.getByRole("button", { name: "slugEdit" });

    // Appended: the button sits in the same row container directly after the
    // input's wrapper (no excerpt/other field in between).
    expect(toggle.parentElement).toContainElement(slugInput);
    expect(toggle.previousElementSibling?.querySelector("input[name='slug']")).toBe(slugInput);
  });

  it("enables slug editing when the appended button is clicked", () => {
    render(<BlogForm mode="create" onSuccess={vi.fn()} />);

    const slugInput = screen.getByPlaceholderText("slugPlaceholder") as HTMLInputElement;
    expect(slugInput).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "slugEdit" }));

    expect(slugInput).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "slugLock" })).toBeInTheDocument();
  });

  it("caps the slug at the same length as the title", () => {
    expect(BLOG_SLUG_MAX_LENGTH).toBe(BLOG_TITLE_MAX_LENGTH);

    render(<BlogForm mode="create" onSuccess={vi.fn()} />);

    expect(screen.getByPlaceholderText("slugPlaceholder")).toHaveAttribute(
      "maxlength",
      String(BLOG_TITLE_MAX_LENGTH),
    );
  });

  it("auto-derives the slug from the title until customized", () => {
    render(<BlogForm mode="create" onSuccess={vi.fn()} />);

    const slugInput = screen.getByPlaceholderText("slugPlaceholder") as HTMLInputElement;
    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Hello World" },
    });
    expect(slugInput).toHaveValue("hello-world");

    // Customize the slug, then retitle: the custom slug must survive.
    fireEvent.click(screen.getByRole("button", { name: "slugEdit" }));
    fireEvent.change(slugInput, { target: { value: "my-custom" } });
    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Completely Different" },
    });
    expect(slugInput).toHaveValue("my-custom");
  });

  it("formats the slug on blur when leaving the input", () => {
    render(<BlogForm mode="create" onSuccess={vi.fn()} />);

    const slugInput = screen.getByPlaceholderText("slugPlaceholder") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "slugEdit" }));
    fireEvent.change(slugInput, { target: { value: "My Custom Slug!" } });
    expect(slugInput).toHaveValue("My Custom Slug!");

    fireEvent.blur(slugInput);

    expect(slugInput).toHaveValue("my-custom-slug");
  });

  it("resumes auto-derivation on blur when nothing slug-able remains", () => {
    render(<BlogForm mode="create" onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Hello World" },
    });
    const slugInput = screen.getByPlaceholderText("slugPlaceholder") as HTMLInputElement;
    expect(slugInput).toHaveValue("hello-world");

    fireEvent.click(screen.getByRole("button", { name: "slugEdit" }));
    fireEvent.change(slugInput, { target: { value: "!!!" } });
    fireEvent.blur(slugInput);

    // Falls back to the title-derived slug and tracks the title again.
    expect(slugInput).toHaveValue("hello-world");
    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Hello World Again" },
    });
    expect(slugInput).toHaveValue("hello-world-again");
  });

  it("sends the custom slug in the create body", async () => {
    const onSuccess = vi.fn();
    render(<BlogForm mode="create" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Hello World" },
    });
    fireEvent.click(screen.getByRole("button", { name: "slugEdit" }));
    fireEvent.change(screen.getByPlaceholderText("slugPlaceholder"), {
      target: { value: "my-custom-slug" },
    });
    const editor = await screen.findByLabelText("mock-editor");
    fireEvent.change(editor, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "publish" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const [, init] = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ title: "Hello World", slug: "my-custom-slug" });
  });

  it("prefills the stored slug in edit mode", () => {
    render(
      <BlogForm
        mode="edit"
        postId="blog-1"
        initialTitle="My Article"
        initialSlug="my-article"
        initialContent="{}"
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("slugPlaceholder")).toHaveValue("my-article");
  });
});
