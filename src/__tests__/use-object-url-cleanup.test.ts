import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useObjectUrlCleanup } from "@/lib/hooks/useObjectUrlCleanup";

describe("useObjectUrlCleanup", () => {
  it("keeps selected previews alive across renders and releases them on discard", () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL: revoke }));
    const { rerender, unmount } = renderHook(({ urls }) => useObjectUrlCleanup(urls), { initialProps: { urls: ["blob:first", "https://media.example.test/photo.jpg"] } });
    rerender({ urls: ["blob:first", "blob:second"] });
    expect(revoke).not.toHaveBeenCalled();
    unmount();
    expect(revoke.mock.calls).toEqual([["blob:first"], ["blob:second"]]);
    vi.unstubAllGlobals();
  });
});
