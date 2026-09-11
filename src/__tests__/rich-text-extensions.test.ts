import { describe, it, expect } from "vitest";
import { createBlogEditorExtensions } from "@/lib/rich-text-extensions";

describe("createBlogEditorExtensions", () => {
  it("bundles the StarterKit blocks with links and an optional placeholder", () => {
    const names = createBlogEditorExtensions("Write...").map((ext) => ext.name);
    expect(names).toContain("starterKit");
    expect(names).toContain("placeholder");
    // Links ship bundled inside StarterKit (a separate Link instance would
    // register a duplicate "link" name): assert the bundled configuration.
    const starterKit = createBlogEditorExtensions("Write...")[0];
    expect(starterKit.options.heading).toMatchObject({ levels: [2, 3] });
    expect(starterKit.options.link).toMatchObject({ openOnClick: false, defaultProtocol: "https" });
  });

  it("omits the placeholder when none is given", () => {
    const names = createBlogEditorExtensions().map((ext) => ext.name);
    expect(names).toEqual(["starterKit"]);
  });
});
