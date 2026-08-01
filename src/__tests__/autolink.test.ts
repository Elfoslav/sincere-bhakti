import { describe, it, expect } from "vitest";
import { tokenizeUrls, getFirstUrl } from "@/lib/autolink";

describe("tokenizeUrls", () => {
  it("returns empty for null/undefined/empty", () => {
    expect(tokenizeUrls(null)).toEqual([]);
    expect(tokenizeUrls(undefined)).toEqual([]);
    expect(tokenizeUrls("")).toEqual([]);
  });

  it("returns a single text token when there is no URL", () => {
    expect(tokenizeUrls("just words")).toEqual([{ type: "text", value: "just words" }]);
  });

  it("splits text and a trailing url", () => {
    expect(tokenizeUrls("see https://example.com")).toEqual([
      { type: "text", value: "see " },
      { type: "url", url: "https://example.com" },
    ]);
  });

  it("handles a URL in the middle of text", () => {
    expect(tokenizeUrls("a https://example.com b")).toEqual([
      { type: "text", value: "a " },
      { type: "url", url: "https://example.com" },
      { type: "text", value: " b" },
    ]);
  });

  it("handles multiple urls", () => {
    expect(tokenizeUrls("x https://a.com y https://b.com z")).toEqual([
      { type: "text", value: "x " },
      { type: "url", url: "https://a.com" },
      { type: "text", value: " y " },
      { type: "url", url: "https://b.com" },
      { type: "text", value: " z" },
    ]);
  });

  it("strips trailing punctuation from a URL", () => {
    expect(tokenizeUrls("go to https://example.com.")).toEqual([
      { type: "text", value: "go to " },
      { type: "url", url: "https://example.com" },
      { type: "text", value: "." },
    ]);
  });

  it("strips trailing comma and keeps surrounding text", () => {
    expect(tokenizeUrls("https://example.com, and")).toEqual([
      { type: "url", url: "https://example.com" },
      { type: "text", value: ", and" },
    ]);
  });

  it("keeps balanced closing parens part of the URL", () => {
    expect(tokenizeUrls("https://en.wikipedia.org/wiki/Foo_(bar)")).toEqual([
      { type: "url", url: "https://en.wikipedia.org/wiki/Foo_(bar)" },
    ]);
  });

  it("strips an unbalanced trailing close paren", () => {
    expect(tokenizeUrls("(see https://example.com)")).toEqual([
      { type: "text", value: "(see " },
      { type: "url", url: "https://example.com" },
      { type: "text", value: ")" },
    ]);
  });

  it("supports http and https", () => {
    expect(tokenizeUrls("http://a.com https://b.com")).toEqual([
      { type: "url", url: "http://a.com" },
      { type: "text", value: " " },
      { type: "url", url: "https://b.com" },
    ]);
  });

  it("does not match javascript: or data: urls", () => {
    const tokens = tokenizeUrls("javascript:alert(1) data:text/html,x");
    expect(tokens.every((t) => t.type === "text")).toBe(true);
  });

  it("handles URL with query string and trailing punctuation", () => {
    expect(tokenizeUrls("https://example.com/?q=1&x=2.")).toEqual([
      { type: "url", url: "https://example.com/?q=1&x=2" },
      { type: "text", value: "." },
    ]);
  });
});

describe("getFirstUrl", () => {
  it("returns the first url", () => {
    expect(getFirstUrl("a https://first.com then https://second.com")).toBe("https://first.com");
  });

  it("returns null when there is no url", () => {
    expect(getFirstUrl("no url here")).toBeNull();
    expect(getFirstUrl(null)).toBeNull();
    expect(getFirstUrl("")).toBeNull();
  });
});
