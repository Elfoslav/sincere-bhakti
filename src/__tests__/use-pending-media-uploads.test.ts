import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/client-upload", () => ({ uploadMediaFiles: vi.fn(), cleanupUploadedMedia: vi.fn().mockResolvedValue(undefined) }));
import { uploadMediaFiles, cleanupUploadedMedia } from "@/lib/client-upload";
import { usePendingMediaUploads } from "@/lib/hooks/usePendingMediaUploads";

const media = { url: "https://media.example.test/one.jpg", type: "image" };
describe("usePendingMediaUploads", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(uploadMediaFiles).mockResolvedValue({ media: [media], error: null }); });
  it("reuses uploads after a failed publish and removes pending uploads on discard", async () => {
    const file = new File(["x"], "one.jpg");
    const { result, unmount } = renderHook(() => usePendingMediaUploads());
    await act(() => result.current.upload("id", [{ file }]));
    await act(() => result.current.upload("id", [{ file }]));
    expect(uploadMediaFiles).toHaveBeenCalledTimes(1);
    unmount();
    expect(cleanupUploadedMedia).toHaveBeenCalledWith([media.url]);
  });
  it("never cleans up committed media on close", async () => {
    const file = new File(["x"], "one.jpg");
    const { result, unmount } = renderHook(() => usePendingMediaUploads());
    await act(() => result.current.upload("id", [{ file }]));
    act(() => result.current.commit([media.url]));
    unmount();
    expect(cleanupUploadedMedia).toHaveBeenCalledWith([]);
  });
  it("cleans partial uploads and keeps them out of the retry cache", async () => {
    vi.mocked(uploadMediaFiles).mockResolvedValue({ media: [media], error: "upload_failed" });
    const file = new File(["x"], "one.jpg");
    const { result } = renderHook(() => usePendingMediaUploads());
    await act(() => result.current.upload("id", [{ file }]));
    await act(() => result.current.upload("id", [{ file }]));
    expect(uploadMediaFiles).toHaveBeenCalledTimes(2);
    expect(cleanupUploadedMedia).toHaveBeenCalledWith([media.url]);
  });
});
