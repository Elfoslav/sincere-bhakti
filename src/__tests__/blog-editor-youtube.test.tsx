import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.spyOn(console, "error").mockImplementation(() => {});
import { toast } from "sonner";
import BlogEditor from "@/components/BlogEditor";

// ProseMirror scrolls the inserted block into view. jsdom has no layout engine.
Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
it("validates, inserts, persists and reopens a YouTube block", async () => {
  const onChange = vi.fn();
  const { unmount } = render(<BlogEditor initialContent="Existing article text" onChange={onChange} />);
  fireEvent.click(await screen.findByRole("button", { name: "embedYoutube" }));
  const input = screen.getByRole("textbox", { name: "youtubeUrlPlaceholder" });
  fireEvent.change(input, { target: { value: "https://evil.test" } });
  fireEvent.click(screen.getByRole("button", { name: "linkApply" }));
  expect(toast.error).toHaveBeenCalledWith("invalidYoutubeUrl");
  fireEvent.change(input, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
  fireEvent.click(screen.getByRole("button", { name: "linkApply" }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const saved = onChange.mock.calls.at(-1)![0];
  expect(saved.contentHtml).toContain("Existing article text");
  expect(saved.contentHtml).toContain("www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  unmount();
  const reopened = render(<BlogEditor initialContent={saved.contentJson} onChange={() => {}} />);
  await waitFor(() => expect(reopened.container.querySelector("iframe")?.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"));
});
