import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const push = vi.hoisted(() => vi.fn());
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { toast } from "sonner";
import { useContentSavedToast } from "@/lib/hooks/useContentSavedToast";

describe("useContentSavedToast", () => {
  it.each(["post", "article", "album"] as const)("provides a real detail link for %s", kind => {
    const { result } = renderHook(() => useContentSavedToast(kind));
    result.current({ shortId: "abc", slug: "reflection", isPublic: true }, "create");
    const [, options] = vi.mocked(toast.success).mock.calls.at(-1)!;
    if (options?.action && typeof options.action === "object" && "onClick" in options.action) options.action.onClick({} as never);
    expect(push).toHaveBeenLastCalledWith(`${kind === "post" ? "/posts" : kind === "article" ? "/blog" : "/gallery"}/abc/reflection`);
  });
  it("explains private and scheduled results even when absent from the current feed", () => {
    const { result } = renderHook(() => useContentSavedToast("article"));
    result.current({ shortId: "abc", slug: null, isPublic: false }, "create");
    expect(toast.success).toHaveBeenLastCalledWith("privateNotice", expect.any(Object));
    result.current({ shortId: "abc", slug: null, isPublic: true, publishedAt: "2099-01-01T00:00:00Z" }, "create");
    expect(toast.success).toHaveBeenLastCalledWith("scheduledNotice", expect.any(Object));
  });
});
