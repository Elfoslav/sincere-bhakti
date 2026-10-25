"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import PostForm, { type PostFormProps } from "@/components/PostForm";
import type { Post } from "@/types/post";

/**
 * Create-post form that stays collapsed behind a quiet prompt until requested,
 * so the feed is reachable without scrolling past the composer (mobile).
 * The form stays mounted while collapsed so a draft survives Cancel.
 */
export default function CollapsibleComposer({
  onSuccess,
  postingChannel,
}: Pick<PostFormProps, "onSuccess" | "postingChannel">) {
  const t = useTranslations("PostsPage");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasToggled = useRef(false);

  // Move focus with the visible control: into the textarea on expand, back to
  // the prompt on collapse. Skipped on first render so the page load doesn't
  // steal focus.
  useEffect(() => {
    if (!hasToggled.current) {
      hasToggled.current = true;
      return;
    }
    if (open) panelRef.current?.querySelector("textarea")?.focus();
    else triggerRef.current?.focus();
  }, [open]);

  function handleSuccess(post: Post) {
    setOpen(false);
    onSuccess(post);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        hidden={open}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-input bg-background px-4 py-3.5 text-left text-base text-muted-foreground transition-colors hover:bg-card focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none"
      >
        {t("composePlaceholder")}
      </button>
      <div id={panelId} ref={panelRef} hidden={!open}>
        <PostForm
          mode="create"
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
          postingChannel={postingChannel}
        />
      </div>
    </>
  );
}
