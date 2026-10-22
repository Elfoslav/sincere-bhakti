import { expect, it } from "vitest";
import { hasRichTextContent } from "@/lib/rich-text";
it("accepts text and video-only bodies while rejecting empty and invalid embeds", () => {
  expect(hasRichTextContent("Text")).toBe(true);
  expect(hasRichTextContent('{"type":"doc","content":[{"type":"paragraph"}]}')).toBe(false);
  const body = (src: string) => JSON.stringify({ type: "doc", content: [{ type: "youtube", attrs: { src } }] });
  expect(hasRichTextContent(body("https://youtu.be/dQw4w9WgXcQ"))).toBe(true);
  expect(hasRichTextContent(body("https://evil.test/embed/dQw4w9WgXcQ"))).toBe(false);
});
