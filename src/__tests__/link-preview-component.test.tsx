import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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
  },
};

describe("LinkPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
  });

  it("renders nothing when there is no url in the text", () => {
    const { container } = render(<LinkPreview text="no links here" />);
    expect(container.innerHTML).toBe("");
  });

  it("fetches the preview for the first url and renders the card", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(PREVIEW),
    });

    const { container } = render(<LinkPreview text="check https://example.com/post out" />);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/link-preview?url=" + encodeURIComponent("https://example.com/post"),
    );

    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });
    expect(screen.getByText("A description")).toBeInTheDocument();
    expect(screen.getByText("Example")).toBeInTheDocument();

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.src).toContain("/api/link-preview/image?url=");
    expect(img.src).toContain(encodeURIComponent("https://cdn.example.com/img.jpg"));

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
          preview: { url: "https://example.com/post", title: "T", description: null, image: null, siteName: null },
        }),
    });
    render(<LinkPreview text="check https://example.com/post out" />);
    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
