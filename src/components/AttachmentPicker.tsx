"use client";

import { useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AttachmentPicker({ label, accept, multiple = false, disabled = false, onFiles, inputRef, onPreparingChange }: {
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
  onPreparingChange?: (preparing: boolean) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  const t = useTranslations("ContentComposer");
  const [dragging, setDragging] = useState(false);
  async function selectFiles(files: File[]) {
    if (disabled) return;
    const allowed = accept.split(",").map(type => type.trim());
    onPreparingChange?.(true);
    try { await onFiles(files.filter(file => allowed.includes(file.type)).slice(0, multiple ? undefined : 1)); }
    finally { onPreparingChange?.(false); if (ref.current) ref.current.value = ""; }
  }
  return <div className={cn("attachment-picker", dragging && "attachment-picker-active")}
    onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragLeave={() => setDragging(false)} onDrop={(event) => {
      event.preventDefault(); setDragging(false);
      selectFiles(Array.from(event.dataTransfer.files));
    }}>
    <input ref={ref} type="file" accept={accept} multiple={multiple} disabled={disabled} aria-label={label} className="sr-only" tabIndex={-1}
      onChange={(event) => { selectFiles(Array.from(event.target.files ?? [])); }} />
    <Button type="button" variant="outline" icon={<Upload />} disabled={disabled} onClick={() => ref.current?.click()}>{label}</Button>
    <p>{t("dropFiles")}</p>
  </div>;
}
