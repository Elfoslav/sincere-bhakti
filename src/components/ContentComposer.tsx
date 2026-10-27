"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { ComposerFormState } from "@/types/content-composer";
import { cn } from "@/lib/utils";

interface ComposerControls {
  formState: Required<ComposerFormState>;
  requestClose: () => void;
  complete: () => void;
  busy: boolean;
}

/** One editor lifecycle for every content type; expanding never remounts the form. */
export default function ContentComposer({ open, onOpenChange, title, children, wide = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  wide?: boolean;
  children: (controls: ComposerControls) => ReactNode;
}) {
  const t = useTranslations("ContentComposer");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || (!dirty && !busy)) return;
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [open, dirty, busy]);

  const complete = useCallback(() => {
    setDirty(false);
    setBusy(false);
    setConfirmLeave(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const requestClose = useCallback(() => {
    // Requests may already have reached the server. Never imply Discard can
    // cancel a publish/upload that is in progress.
    if (busy) return;
    if (dirty) setConfirmLeave(true);
    else onOpenChange(false);
  }, [busy, dirty, onOpenChange]);

  return <>
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) requestClose();
      else onOpenChange(true);
    }}>
      <DialogContent ref={contentRef} showCloseButton={false}
        className={cn("content-composer", wide && "content-composer-wide", expanded && "content-composer-expanded")}
        initialFocus={() => {
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          return contentRef.current?.querySelector<HTMLElement>('input:not([type="hidden"]):not([type="file"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]') ?? contentRef.current;
        }}
        finalFocus={() => openerRef.current?.isConnected ? openerRef.current : undefined}>
        <div className="content-composer-header">
          <DialogHeader text={title} subheading={t("description")} titleClassName="text-2xl" />
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="icon" className="hidden sm:inline-flex" icon={expanded ? <Minimize2 /> : <Maximize2 />}
              aria-label={t(expanded ? "collapse" : "expand")} aria-pressed={expanded}
              onClick={() => setExpanded(!expanded)} />
            <Button type="button" variant="icon" icon={<X />} aria-label={t("close")} disabled={busy} onClick={requestClose} />
          </div>
        </div>
        <div className="content-composer-body" aria-busy={busy}>
          {children({ formState: { onDirtyChange: setDirty, onSubmittingChange: setBusy }, requestClose, complete, busy })}
        </div>
        <p role="status" className="sr-only">{busy ? t("working") : ""}</p>
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={confirmLeave} onOpenChange={setConfirmLeave} title={t("unsavedTitle")}
      description={t("unsavedDescription")} cancelLabel={t("keepEditing")} confirmLabel={t("discard")}
      onConfirm={complete} variant="destructive" />
  </>;
}
