import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Node, type Extensions } from "@tiptap/core";

import { getPrivateYouTubeEmbedUrl } from "@/lib/video";

const YouTube = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    };
  },
  parseHTML() {
    return [{
      tag: "iframe[src]",
      getAttrs: (element) => {
        const src = getPrivateYouTubeEmbedUrl(element.getAttribute("src") ?? "");
        return src ? { src, title: element.getAttribute("title") } : false;
      },
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const src = getPrivateYouTubeEmbedUrl(HTMLAttributes.src ?? "");
    if (!src) return ["p"];
    return ["iframe", {
      src, title: HTMLAttributes.title, loading: "lazy", allowfullscreen: "true",
      allow: "encrypted-media; picture-in-picture; fullscreen",
      referrerpolicy: "strict-origin-when-cross-origin",
    }];
  },
});

/**
 * The single editor schema for blog articles, shared by the client editor
 * and (indirectly) the server sanitizer allowlist in rich-text-html.ts.
 * Keep the two in sync: every node/mark enabled here must have a matching
 * allowed tag in RICH_TEXT_ALLOWED_TAGS.
 */
export function createBlogEditorExtensions(placeholder?: string): Extensions {
  return [
    // No h1: the article title already is the page heading — body sections
    // start at h2 for a valid outline.
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // Link ships bundled since StarterKit v3.31 — a separate Link instance
      // would register a duplicate "link" name.
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    YouTube,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}
