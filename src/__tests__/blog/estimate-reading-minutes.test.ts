import { describe, expect, it } from "vitest";
import { estimateReadingMinutes } from "@/lib/blog";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("estimateReadingMinutes", () => {
  it("returns 0 for empty or text-free input", () => {
    expect(estimateReadingMinutes(null)).toBe(0);
    expect(estimateReadingMinutes("")).toBe(0);
    expect(estimateReadingMinutes("<p> </p><img src='x'>")).toBe(0);
  });

  it("rounds up and never goes below one minute", () => {
    expect(estimateReadingMinutes(`<p>${words(10)}</p>`)).toBe(1);
    expect(estimateReadingMinutes(`<p>${words(200)}</p>`)).toBe(1);
    expect(estimateReadingMinutes(`<p>${words(201)}</p>`)).toBe(2);
    expect(estimateReadingMinutes(`<p>${words(1000)}</p>`)).toBe(5);
  });

  it("ignores tags, scripts, styles and entities", () => {
    const html = `<style>p{color:red}</style><script>var a = ${words(500)}</script><p>${words(200)}&nbsp;&amp;</p>`;
    expect(estimateReadingMinutes(html)).toBe(1);
  });

  it("counts non-Latin words such as IAST and Czech text", () => {
    expect(estimateReadingMinutes("<p>Kṛṣṇa bhakti śāstra</p>")).toBe(1);
  });

  it("honours a custom reading speed", () => {
    expect(estimateReadingMinutes(`<p>${words(300)}</p>`, 100)).toBe(3);
  });
});
