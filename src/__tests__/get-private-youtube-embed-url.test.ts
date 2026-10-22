import { describe, expect, it } from "vitest";
import { getPrivateYouTubeEmbedUrl } from "@/lib/video";
describe("getPrivateYouTubeEmbedUrl", () => {
  it.each([
    "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=30",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
  ])("canonicalizes %s", (url) => {
    expect(getPrivateYouTubeEmbedUrl(url)).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
  it.each(["https://evil.test/youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "javascript:youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=dQw4w9WgXcQextra", "https://user@youtube.com/watch?v=dQw4w9WgXcQ"])("rejects %s", (url) => {
    expect(getPrivateYouTubeEmbedUrl(url)).toBeNull();
  });
});
