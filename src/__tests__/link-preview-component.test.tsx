import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

import LinkPreview from "@/components/LinkPreview";

const PREVIEW = {
  preview: {
    url: "https://example.com/post",
    title: "Hello World",
    description: "A description",
    image: "https://cdn.example.com/img.jpg",
    siteName: "Example",
    favicon: "https://example.com/favicon.ico",
  },
};

describe("LinkPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when there is no url in the text", () => {
    const { container } = render(<LinkPreview text="no links here" />);
    expect(container.innerHTML).toBe("");
  });

  it("debounces url changes so typing does not fire a request per keystroke", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ preview: null }),
    });

    // Initial render fires immediately (static text); it is the URL *changes*
    // that are debounced while typing.
    const { rerender } = render(<LinkPreview text="check https://exa" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(<LinkPreview text="check https://examp" />);
    rerender(<LinkPreview text="check https://example.com/post out" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/link-preview?url=" + encodeURIComponent("https://example.com/post"),
    );
  });

  it("fetches the preview for the first url and renders the card", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(PREVIEW),
    });

    const { container } = render(<LinkPreview text="check https://example.com/post out" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/link-preview?url=" + encodeURIComponent("https://example.com/post"),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });
    expect(screen.getByText("A description")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();

    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(2);
    expect((imgs[0] as HTMLImageElement).src).toContain("/api/link-preview/image?url=");
    expect((imgs[0] as HTMLImageElement).src).toContain(encodeURIComponent("https://cdn.example.com/img.jpg"));
    expect((imgs[1] as HTMLImageElement).src).toContain(encodeURIComponent("https://example.com/favicon.ico"));

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/post");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders nothing when the fetch fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { container } = render(<LinkPreview text="check https://example.com/post out" />);
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("renders nothing when the payload has no preview", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ preview: null }),
    });
    const { container } = render(<LinkPreview text="check https://example.com/post out" />);
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("shows no image when the preview has no image", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          preview: { url: "https://example.com/post", title: "T", description: null, image: null, siteName: null, favicon: null },
        }),
    });
    render(<LinkPreview text="check https://example.com/post out" />);
    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
