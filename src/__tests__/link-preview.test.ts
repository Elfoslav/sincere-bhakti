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
      favicon: null,
    });
  });

  it("parses meta tags regardless of attribute order (content before property/name)", () => {
    const html = `
      <html>
        <head>
          <meta content="A Great Post" property="og:title" />
          <meta content="Short description" property="og:description">
          <meta content="https://cdn.example.com/img.jpg" property="og:image"/>
          <meta content="Example Site" property="og:site_name" />
          <meta content="Tweet desc" name="twitter:description" />
        </head>
      </html>
    `;
    expect(parseLinkPreview(html, PAGE_URL)).toEqual({
      url: PAGE_URL,
      title: "A Great Post",
      description: "Short description",
      image: "https://cdn.example.com/img.jpg",
      siteName: "Example Site",
      favicon: null,
    });
  });

  it("ignores charset/http-equiv meta and keeps the first occurrence of a key", () => {
    const html = `
      <meta charset="utf-8" />
      <meta http-equiv="content-type" content="text/html" />
      <meta content="First" property="og:title" />
      <meta property="og:title" content="Second" />
    `;
    expect(parseLinkPreview(html, PAGE_URL).title).toBe("First");
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

  it("prefers the first <h1> over <title> (WhatsApp-style visible heading)", () => {
    const html = "<title>CHAPTER ONE</title><h1>Questions by the Sages</h1>";
    expect(parseLinkPreview(html, PAGE_URL).title).toBe("Questions by the Sages");
  });

  it("falls back to <h2> when there is no <h1>", () => {
    const html = "<title>Chapter</title><h2>Notes and References</h2>";
    expect(parseLinkPreview(html, PAGE_URL).title).toBe("Notes and References");
  });

  it("picks the largest body image when there is no og:image", () => {
    const html = `
      <img src="https://cdn.example.com/small.jpg" width="64" height="64" />
      <img src="/large.jpg" width="1200" height="630" />
      <img src="https://cdn.example.com/tiny.gif" width="1" height="1" />
    `;
    expect(parseLinkPreview(html, PAGE_URL).image).toBe("https://example.com/large.jpg");
  });

  it("prefers the real src over data-src regardless of attribute order", () => {
    const srcFirst = '<img src="/real.jpg" data-src="/lazy.jpg" width="800" height="600" />';
    const dataFirst = '<img data-src="/lazy.jpg" src="/real.jpg" width="800" height="600" />';
    expect(parseLinkPreview(srcFirst, PAGE_URL).image).toBe("https://example.com/real.jpg");
    expect(parseLinkPreview(dataFirst, PAGE_URL).image).toBe("https://example.com/real.jpg");
  });

  it("resolves a relative body image against the page URL", () => {
    const html = '<img src="/art/chapter.jpg" width="800" height="600" />';
    expect(parseLinkPreview(html, PAGE_URL).image).toBe("https://example.com/art/chapter.jpg");
  });

  it("ignores tracker/analytics images when scanning the body", () => {
    const html = `
      <img src="https://simpleanalyticsbadges.com/vedabase.io?mode=auto" width="512" height="128" />
      <img src="https://cdn.example.com/real.jpg" width="400" height="300" />
    `;
    expect(parseLinkPreview(html, PAGE_URL).image).toBe("https://cdn.example.com/real.jpg");
  });

  it("returns no image when only trackers are present", () => {
    const html = '<img src="https://simpleanalyticsbadges.com/vedabase.io?mode=auto" width="512" height="128" />';
    expect(parseLinkPreview(html, PAGE_URL).image).toBeNull();
  });

  it("does not override a real og:image with a body image", () => {
    const html = `
      <meta property="og:image" content="https://cdn.example.com/og.jpg" />
      <img src="https://cdn.example.com/big.jpg" width="2000" height="1000" />
    `;
    expect(parseLinkPreview(html, PAGE_URL).image).toBe("https://cdn.example.com/og.jpg");
  });

  it("keeps a literal > inside an attribute value from truncating the tag", () => {
    const html = `
      <meta property="og:title" content="Tips &amp; Tricks > A Guide" />
      <meta content="Faster > slower comparison" property="og:description" />
      <img src="https://cdn.example.com/real.jpg" alt="width > 0" width="800" height="600" />
    `;
    const result = parseLinkPreview(html, PAGE_URL);
    expect(result.title).toBe("Tips & Tricks > A Guide");
    expect(result.description).toBe("Faster > slower comparison");
    expect(result.image).toBe("https://cdn.example.com/real.jpg");
  });

  it("extracts a favicon from link rel=icon", () => {
    const html = '<link rel="icon" href="/favicon.ico" />';
    expect(parseLinkPreview(html, PAGE_URL).favicon).toBe("https://example.com/favicon.ico");
  });

  it("matches favicon rel regardless of token order or attribute position", () => {
    const relFirstMultiToken = '<link rel="icon shortcut" href="/a.ico" />';
    expect(parseLinkPreview(relFirstMultiToken, PAGE_URL).favicon).toBe("https://example.com/a.ico");

    const hrefBeforeRel = '<link href="/b.png" rel="apple-touch-icon" sizes="180x180" />';
    expect(parseLinkPreview(hrefBeforeRel, PAGE_URL).favicon).toBe("https://example.com/b.png");
  });

  it("does not treat non-favicon icon-like rels as a favicon", () => {
    const html = '<link rel="mask-icon" href="/mask.svg" />';
    expect(parseLinkPreview(html, PAGE_URL).favicon).toBeNull();
  });

  it("resolves relative favicon against the page URL", () => {
    const html = '<link rel="shortcut icon" href="/static/logo.png" />';
    expect(parseLinkPreview(html, PAGE_URL).favicon).toBe("https://example.com/static/logo.png");
  });

  it("returns null favicon when none is declared", () => {
    expect(parseLinkPreview("<html></html>", PAGE_URL).favicon).toBeNull();
  });

  it("drops non-http(s) favicon", () => {
    const html = '<link rel="icon" href="javascript:alert(1)" />';
    expect(parseLinkPreview(html, PAGE_URL).favicon).toBeNull();
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
      favicon: null,
    });
  });

  it("returns nulls for empty content", () => {
    expect(parseLinkPreview("<html></html>", PAGE_URL)).toEqual({
      url: PAGE_URL,
      title: null,
      description: null,
      image: null,
      siteName: null,
      favicon: null,
    });
  });

  it("trims whitespace-only values to null", () => {
    const html = '<meta property="og:title" content="   " />';
    expect(parseLinkPreview(html, PAGE_URL).title).toBeNull();
  });

  it("decodes numeric HTML entities in meta descriptions", () => {
    const html = '<meta name="description" content="Srila Prabhupada&#x27;s books online" />';
    expect(parseLinkPreview(html, PAGE_URL).description).toBe("Srila Prabhupada's books online");
  });

  it("decodes common named HTML entities", () => {
    const html = '<meta property="og:title" content="Rising &amp; Falling &mdash; a &quot;tale&quot;" />';
    expect(parseLinkPreview(html, PAGE_URL).title).toBe('Rising & Falling — a "tale"');
  });

  it("leaves unknown entities unchanged", () => {
    const html = '<meta property="og:title" content="Stay &unknown;" />';
    expect(parseLinkPreview(html, PAGE_URL).title).toBe("Stay &unknown;");
  });

  it("decodes entities in og:image attribute values", () => {
    const html = '<meta property="og:image" content="https://cdn.example.com/a&amp;b.jpg" />';
    expect(parseLinkPreview(html, PAGE_URL).image).toBe("https://cdn.example.com/a&b.jpg");
  });
});
