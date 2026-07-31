import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { searchParams, updateSession, router, fetchMock } = vi.hoisted(() => ({
  searchParams: {
    get: vi.fn(),
  },
  updateSession: vi.fn(async () => null),
  router: {
    push: vi.fn(),
  },
  fetchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => searchParams),
}));
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    status: "authenticated",
    update: updateSession,
  })),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(() => router),
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

import VerifyEmailPage from "@/app/[locale]/(auth)/verify-email/page";

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
  });

  it("refreshes the session after successful verification so emailVerifiedAt is updated", async () => {
    searchParams.get.mockReturnValue("token123");
    fetchMock.mockResolvedValue({ ok: true });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "token123" }),
      });
    });
    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the posts CTA and routes to /posts when authenticated", async () => {
    searchParams.get.mockReturnValue("token123");
    fetchMock.mockResolvedValue({ ok: true });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByText("showPosts"));
    expect(router.push).toHaveBeenCalledWith("/posts");
  });

  it("does not refresh the session when verification fails", async () => {
    searchParams.get.mockReturnValue("token123");
    fetchMock.mockResolvedValue({ ok: false });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText("error")).toBeTruthy();
    });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("keeps a successful verification as success even if the session refresh fails", async () => {
    searchParams.get.mockReturnValue("token123");
    fetchMock.mockResolvedValue({ ok: true });
    updateSession.mockRejectedValueOnce(new Error("network"));

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText("success")).toBeTruthy();
    });
  });
});
