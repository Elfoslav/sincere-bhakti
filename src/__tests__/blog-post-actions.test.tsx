import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

vi.spyOn(console, "error").mockImplementation(() => {});

import { toast } from "sonner";
import BlogPostActions from "@/components/BlogPostActions";
import type { BlogPost } from "@/types/blog";

const post: BlogPost = {
  id: "blog-1",
  shortId: "abc12345",
  slug: "my-article",
  title: "My Article",
  excerpt: "Summary",
  content: "Body",
  coverUrl: null,
  isPublic: true,
  language: "en",
  publishedAt: "2026-09-01T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  channel: { id: "channel-1", name: "Devotee", slug: "devotee", avatarUrl: null, ownerId: "user-1" },
};

describe("BlogPostActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders edit, delete, and copy buttons for the channel owner", () => {
    render(
      <BlogPostActions post={post} currentUserId="user-1" onDelete={() => {}} onEdit={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "editPost" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "copyLink" })).toBeInTheDocument();
  });

  it("renders nothing for a viewer without manage rights", () => {
    const { container } = render(
      <BlogPostActions post={post} currentUserId="stranger" onDelete={() => {}} onEdit={() => {}} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when no action callbacks are provided", () => {
    const { container } = render(
      <BlogPostActions post={post} currentUserId="user-1" />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("copies the blog detail link to the clipboard", async () => {
    const writeText = vi.fn();
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <BlogPostActions post={post} currentUserId="user-1" onDelete={() => {}} onEdit={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "copyLink" }));

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/blog/abc12345/my-article");
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled();
    });
  });

  it("deletes via the confirm dialog and notifies the parent", async () => {
    const onDelete = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    render(
      <BlogPostActions post={post} currentUserId="user-1" onDelete={onDelete} onEdit={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    // The icon button and the dialog confirm button share the label.
    const confirmButtons = screen.getAllByRole("button", { name: "delete" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/blog-posts/blog-1", { method: "DELETE" });
      expect(onDelete).toHaveBeenCalledWith("blog-1");
    });
  });
});
