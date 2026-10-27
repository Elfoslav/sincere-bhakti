import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useComposerFormState } from "@/lib/hooks/useComposerFormState";

describe("useComposerFormState", () => {
  it("reports reversible edits and upload/submission state", () => {
    const onDirtyChange = vi.fn(), onSubmittingChange = vi.fn();
    const { rerender } = renderHook(({ snapshot, busy }) => useComposerFormState({ snapshot, busy, onDirtyChange, onSubmittingChange }), { initialProps: { snapshot: "original", busy: false } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    rerender({ snapshot: "edited media order", busy: true });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(onSubmittingChange).toHaveBeenLastCalledWith(true);
    rerender({ snapshot: "original", busy: false });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(onSubmittingChange).toHaveBeenLastCalledWith(false);
  });
});
