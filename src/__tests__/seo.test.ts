import { describe, expect, it, vi } from "vitest";
import {
  createBreadcrumbJsonLd,
  createChannelJsonLd,
  createJsonLdScript,
  createPostJsonLd,
  getCanonicalAlternates,
  getChannelOpenGraphImageUrl,
  getLocalizedPath,
  getNoIndexMetadata,
  getPostOpenGraphImageUrl,
  getPostSeoDescription,
  getPostSeoTitle,
  normalizeSeoText,
  truncateSeoText,
} from "@/lib/seo";

vi.mock("@/lib/url", () => ({
  getSiteUrl: () => "https://example.test",
}));

describe("seo helpers", () => {
  it("normalizes and truncates text for metadata", () => {
    expect(normalizeSeoText("  Hare\n\n Krishna\tdevotee  ")).toBe("Hare Krishna devotee");
    expect(truncateSeoText("Hare Krishna dear devotees and friends", 24)).toBe("Hare Krishna dear...");
  });

  it("builds post titles with channel name and trimmed content", () => {
    expect(getPostSeoTitle("Govinda Das", " A short realization ")).toBe("Govinda Das: A short realization");
    expect(getPostSeoTitle("Govinda Das", "")).toBe("Govinda Das");
  });

  it("falls back to channel description when post has no text", () => {
    expect(getPostSeoDescription("Govinda Das", "")).toBe("A devotional post from Govinda Das.");
  });

  it("builds localized paths and alternates", () => {
    expect(getLocalizedPath("en", "/posts/1")).toBe("/posts/1");
    expect(getLocalizedPath("cs", "/posts/1")).toBe("/cs/posts/1");
    expect(getCanonicalAlternates("sk", "/channels/test")).toEqual({
      canonical: "https://example.test/sk/channels/test",
      languages: {
        en: "https://example.test/channels/test",
        cs: "https://example.test/cs/channels/test",
        sk: "https://example.test/sk/channels/test",
      },
    });
  });

  it("builds generated post Open Graph image URLs", () => {
    expect(getPostOpenGraphImageUrl("en", "post-1")).toBe("https://example.test/posts/post-1/opengraph-image");
    expect(getPostOpenGraphImageUrl("cs", "post-1")).toBe("https://example.test/cs/posts/post-1/opengraph-image");
  });

  it("builds generated channel Open Graph image URLs", () => {
    expect(getChannelOpenGraphImageUrl("en", "govinda")).toBe("https://example.test/channels/govinda/opengraph-image");
  });

  it("builds escaped JSON-LD script content", () => {
    expect(createJsonLdScript({ name: "<script>" })).toEqual({
      __html: '{"name":"\\u003cscript>"}',
    });
  });

  it("builds structured data for posts, channels, profiles, and breadcrumbs", () => {
    expect(createPostJsonLd({
      title: "Govinda Das: Hare Krishna",
      description: "Hare Krishna",
      url: "https://example.test/posts/post-1",
      imageUrl: "https://example.test/posts/post-1/opengraph-image",
      channelName: "Govinda Das",
      content: "Hare Krishna",
      createdAt: "2026-07-19T00:00:00.000Z",
      language: "en",
    })).toMatchObject({
      "@context": "https://schema.org",
      "@type": "SocialMediaPosting",
      headline: "Govinda Das: Hare Krishna",
      image: ["https://example.test/posts/post-1/opengraph-image"],
      author: { "@type": "Organization", name: "Govinda Das" },
    });
    expect(createChannelJsonLd({
      name: "Govinda Das",
      description: "Browse posts from Govinda Das",
      url: "https://example.test/channels/govinda-das",
      imageUrl: "https://example.test/images/sincere-bhakti-logo.png",
    })).toMatchObject({
      "@type": "ProfilePage",
      image: "https://example.test/images/sincere-bhakti-logo.png",
      mainEntity: { "@type": "Organization", name: "Govinda Das", image: "https://example.test/images/sincere-bhakti-logo.png" },
    });
    expect(createBreadcrumbJsonLd([
      { name: "Posts", url: "https://example.test/posts" },
      { name: "Post", url: "https://example.test/posts/post-1" },
    ])).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Posts" },
        { "@type": "ListItem", position: 2, name: "Post" },
      ],
    });
  });

  it("returns noindex metadata for private pages", () => {
    expect(getNoIndexMetadata("Settings")).toEqual({
      title: "Settings",
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
    });
  });
});
