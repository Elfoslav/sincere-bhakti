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

describe("EditBlogModal private save buttons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ posts: [] }) });
  });

  it("stays open on Save & stay and closes on Save & leave", async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    render(
      <EditBlogModal post={makePost({ isPublic: false })} open onOpenChange={onOpenChange} onSuccess={onSuccess} />,
    );

    // Private articles offer Save & stay / Save & leave (same pair as create).
    await screen.findByRole("button", { name: "saveAndStay" });
    fireEvent.click(screen.getByRole("button", { name: "saveAndStay" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // Stay: the parent receives the update with exit=false but the modal
    // remains open (parents dismiss only on exit=true).
    expect(onSuccess).toHaveBeenCalledWith(expect.anything(), false);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("mock-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "saveAndLeave" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenLastCalledWith(expect.anything(), true);
  });
});

describe("EditBlogModal unsaved-changes guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ posts: [] }) });
  });

  it("closes immediately when nothing changed", async () => {
    const onOpenChange = vi.fn();
    render(
      <EditBlogModal post={makePost()} open onOpenChange={onOpenChange} onSuccess={() => {}} />,
    );

    await screen.findByLabelText("mock-editor");
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("unsavedTitle")).not.toBeInTheDocument();
  });

  it("confirms before discarding edits on Cancel", async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    render(
      <EditBlogModal post={makePost()} open onOpenChange={onOpenChange} onSuccess={onSuccess} />,
    );

    await screen.findByLabelText("mock-editor");
    fireEvent.change(screen.getByPlaceholderText("titlePlaceholder"), {
      target: { value: "Edited title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    // Dirty: the custom confirm appears instead of closing.
    await screen.findByText("unsavedTitle");
    // The confirm dims the edit modal beneath it: both overlays render, the
    // confirm's last in DOM order so it paints on top (equal z-index).
    const overlays = document.querySelectorAll('[data-slot="dialog-overlay"]');
    expect(overlays).toHaveLength(2);
    expect(overlays[1].compareDocumentPosition(screen.getByText("unsavedTitle"))).toBe(
      overlays[1].DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText("unsavedDescription")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    // Backing out keeps the modal open with edits intact.
    fireEvent.click(screen.getByRole("button", { name: "keepEditing" }));
    await waitFor(() => expect(screen.queryByText("unsavedTitle")).not.toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("titlePlaceholder")).toHaveValue("Edited title");

    // Confirming discards the edits and closes.
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    await screen.findByText("unsavedTitle");
    fireEvent.click(screen.getByRole("button", { name: "leaveWithoutSaving" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("EditBlogModal sticky toolbar spacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ posts: [] }) });
  });

  it("leaves no top padding above the sticky toolbar", async () => {
    render(<EditBlogModal post={makePost()} open onOpenChange={() => {}} onSuccess={() => {}} />);

    await screen.findByLabelText("mock-editor");
    // Sticky respects container padding: any top padding would leave a
    // content strip above the stuck bar. The header carries its own instead.
    const dialog = screen.getByRole("dialog");
    expect(dialog.className.split(/\s+/)).toContain("pt-0");
    const header = document.querySelector('[data-slot="dialog-header"]');
    expect(header?.className.split(/\s+/)).toContain("pt-4");
  });
});
