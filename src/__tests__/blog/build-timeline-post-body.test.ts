import { describe, it, expect } from "vitest";
import { buildTimelinePostBody } from "@/lib/blog";

describe("buildTimelinePostBody", () => {
  it("inherits channel, language, and visibility from the article", () => {
    expect(buildTimelinePostBody({
      id: "blog-1",
      channel: { id: "channel-1" },
      language: "cs",
      isPublic: false,
      publishedAt: null,
    })).toEqual({
      channelId: "channel-1",
      language: "cs",
      isPublic: false,
      blogPostId: "blog-1",
    });
  });

  it("omits the publish date for immediately visible articles", () => {
    const body = buildTimelinePostBody({
      id: "blog-1",
      channel: { id: "channel-1" },
      language: "en",
      isPublic: true,
      publishedAt: null,
    });
    expect(body).not.toHaveProperty("publishedAt");
  });

  it("carries a scheduled article's publish date so the promo goes live with it", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(buildTimelinePostBody({
      id: "blog-1",
      channel: { id: "channel-1" },
      language: "en",
      isPublic: true,
      publishedAt: future,
    })).toEqual({
      channelId: "channel-1",
      language: "en",
      isPublic: true,
      blogPostId: "blog-1",
      publishedAt: future.toISOString(),
    });
  });

  it("accepts ISO-string publish dates (form state)", () => {
    const iso = new Date(Date.now() + 86_400_000).toISOString();
    const body = buildTimelinePostBody({
      id: "blog-1",
      channel: { id: "channel-1" },
      language: "en",
      isPublic: true,
      publishedAt: iso,
    });
    expect(body.publishedAt).toBe(iso);
  });
});
