import { describe, it, expect } from "vitest";
import { parseLinkPreview } from "@/lib/link-preview";

const PAGE_URL = "https://example.com/post/1";

describe("parseLinkPreview", () => {
  it("extracts og fields", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="A Great Post" />
          <meta property="og:description" content="Short description" />
          <meta property="og:image" content="https://cdn.example.com/img.jpg" />
          <meta property="og:site_name" content="Example Site" />
        </head>
      </html>
    `;
    expect(parseLinkPreview(html, PAGE_URL)).toEqual({
      url: PAGE_URL,
      title: "A Great Post",
      description: "Short description",
      image: "https://cdn.example.com/img.jpg",
      siteName: "Example Site",
    });
  });

  it("resolves relative og:image against the page URL", () => {
    const html = '<meta property="og:image" content="/static/og.jpg" />';
    expect(parseLinkPreview(html, PAGE_URL).image).toBe("https://example.com/static/og.jpg");
  });

  it("drops non-http(s) og:image", () => {
    const html = '<meta property="og:image" content="data:image/png;base64,AAAA" />';
    expect(parseLinkPreview(html, PAGE_URL).image).toBeNull();
  });

  it("falls back to <title> when no og:title", () => {
    const html = "<title>Fallback Title</title>";
    expect(parseLinkPreview(html, PAGE_URL).title).toBe("Fallback Title");
  });

  it("uses twitter: tags when og tags are missing", () => {
    const html = `
      <meta name="twitter:title" content="Tweet title" />
      <meta name="twitter:description" content="Tweet desc" />
      <meta name="twitter:image" content="https://cdn.example.com/t.jpg" />
    `;
    expect(parseLinkPreview(html, PAGE_URL)).toEqual({
      url: PAGE_URL,
      title: "Tweet title",
      description: "Tweet desc",
      image: "https://cdn.example.com/t.jpg",
      siteName: null,
    });
  });

  it("returns nulls for empty content", () => {
    expect(parseLinkPreview("<html></html>", PAGE_URL)).toEqual({
      url: PAGE_URL,
      title: null,
      description: null,
      image: null,
      siteName: null,
    });
  });

  it("trims whitespace-only values to null", () => {
    const html = '<meta property="og:title" content="   " />';
    expect(parseLinkPreview(html, PAGE_URL).title).toBeNull();
  });
});
