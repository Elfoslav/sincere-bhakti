"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useTranslations } from "next-intl";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Unlink,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBlogEditorExtensions } from "@/lib/rich-text-extensions";
import { extractPlainText, toEditorContent } from "@/lib/rich-text";
import { BLOG_CONTENT_MAX_LENGTH, isSafeHttpUrl } from "@/lib/validation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface BlogEditorChange {
  contentJson: string;
  contentHtml: string;
  plainLength: number;
}

export default function BlogEditor({
  initialContent,
  placeholder,
  onChange,
}: {
  initialContent?: string | null;
  placeholder?: string;
  onChange: (change: BlogEditorChange) => void;
}) {
  const t = useTranslations("BlogPage");

  const extensions = useMemo(() => createBlogEditorExtensions(placeholder), [placeholder]);

  // Mount-once content: the parent re-renders on every keystroke (content
  // state), so the editor must not depend on it or typing would reset.
  // Parents remount via key when switching articles.
  const [initialDoc] = useState(() => toEditorContent(initialContent));

  const editor = useEditor({
    extensions,
    content: initialDoc,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-text min-h-48 px-3 py-2 focus:outline-none" },
    },
    onUpdate: ({ editor: e }) => {
      const contentJson = JSON.stringify(e.getJSON());
      onChange({
        contentJson,
        contentHtml: e.getHTML(),
        plainLength: extractPlainText(contentJson).trim().length,
      });
    },
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  // Whether the toolbar is currently stuck to the scrollport top. Drives the
  // top radius: rounded at rest, square while stuck (rounded corners would
  // leave background wedges above the stuck bar).
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // A 1px sentinel above the toolbar reports stuck state: fully visible at
  // rest, clipped once the bar sticks. The nearest scrolling ancestor is the
  // observer root (page viewport for the create form, dialog scroll area for
  // the edit modal); without one there is nothing to stick to (or no
  // IntersectionObserver, e.g. old browsers) and the bar stays rounded.
  useEffect(() => {
    if (!editor) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    let scrollParent: HTMLElement | null = null;
    let node = sentinel.parentElement;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollParent = node;
        break;
      }
      node = node.parentElement;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { root: scrollParent, threshold: 1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [editor]);

  function openLinkBar() {
    if (!editor) return;
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      setLinkOpen(false);
      return;
    }
    if (!isSafeHttpUrl(url)) {
      toast.error(t("invalidLinkUrl"));
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
    setLinkOpen(false);
  }

  if (!editor) return null;

  const tool = (
    active: boolean,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <Button
      key={label}
      type="button"
      variant="icon"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(active && "bg-sand")}
      icon={icon}
    />
  );

  return (
    // No overflow-hidden here: it would trap position:sticky and the toolbar
    // could never engage. Only the bottom counter keeps a radius; the toolbar
    // rounds its top at rest and squares off while stuck (see `stuck`).
    <div className="rounded-lg border border-input bg-transparent focus-within:border-ring">
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {/* Sticky so long articles keep formatting in reach while scrolling (page
      scroll and the edit-modal scroll alike). Solid surface: transparent would
      let the scrolled body show through — white matches the card and the light
      modal, card-tinted in dark mode. */}
      <div
        className={cn(
          "sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-sand/60 bg-white p-1.5 dark:bg-card",
          !stuck && "rounded-t-lg",
        )}
        role="toolbar"
        aria-label={t("formattingToolbar")}
      >
        {tool(editor.isActive("bold"), t("formatBold"), <Bold className="size-4" />, () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {tool(editor.isActive("italic"), t("formatItalic"), <Italic className="size-4" />, () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {tool(editor.isActive("strike"), t("formatStrike"), <Strikethrough className="size-4" />, () =>
          editor.chain().focus().toggleStrike().run(),
        )}
        {tool(editor.isActive("heading", { level: 2 }), t("formatH2"), <Heading2 className="size-4" />, () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(),
        )}
        {tool(editor.isActive("heading", { level: 3 }), t("formatH3"), <Heading3 className="size-4" />, () =>
          editor.chain().focus().toggleHeading({ level: 3 }).run(),
        )}
        {tool(editor.isActive("bulletList"), t("formatBulletList"), <List className="size-4" />, () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        {tool(editor.isActive("orderedList"), t("formatOrderedList"), <ListOrdered className="size-4" />, () =>
          editor.chain().focus().toggleOrderedList().run(),
        )}
        {tool(editor.isActive("blockquote"), t("formatQuote"), <Quote className="size-4" />, () =>
          editor.chain().focus().toggleBlockquote().run(),
        )}
        {tool(editor.isActive("link"), t("formatLink"), <Link2 className="size-4" />, openLinkBar)}
        {editor.isActive("link")
          ? tool(false, t("formatUnlink"), <Unlink className="size-4" />, () =>
            editor.chain().focus().unsetLink().run(),
          )
          : null}
        {tool(false, t("formatUndo"), <Undo2 className="size-4" />, () => editor.chain().focus().undo().run())}
        {tool(false, t("formatRedo"), <Redo2 className="size-4" />, () => editor.chain().focus().redo().run())}
      </div>
      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-sand/60 p-1.5">
          <Input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinkOpen(false);
            }}
            placeholder={t("linkUrlPlaceholder")}
            autoComplete="off"
            className="h-8"
          />
          <Button type="button" variant="default" size="sm" onClick={applyLink}>
            {t("linkApply")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLinkOpen(false)}>
            {t("cancel")}
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
      <p className="rounded-b-lg border-t border-sand/60 px-3 py-1 text-right text-[11px] tabular-nums text-deep/40">
        {t("characterCount", {
          count: extractPlainText(JSON.stringify(editor.getJSON())).trim().length,
          max: BLOG_CONTENT_MAX_LENGTH,
        })}
      </p>
    </div>
  );
}
