import { useEffect, useState } from "react";
import type { ComposerFormState } from "@/types/content-composer";

/** Compare the mounted form to its original values, including media order. */
export function useComposerFormState({ snapshot, busy, onDirtyChange, onSubmittingChange }: ComposerFormState & {
  snapshot: string;
  busy: boolean;
}) {
  const [initialSnapshot] = useState(snapshot);
  useEffect(() => { onDirtyChange?.(snapshot !== initialSnapshot); }, [snapshot, initialSnapshot, onDirtyChange]);
  useEffect(() => { onSubmittingChange?.(busy); }, [busy, onSubmittingChange]);
}
