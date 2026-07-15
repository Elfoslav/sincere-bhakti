import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { router, signIn } = vi.hoisted(() => ({
  router: {
    replace: vi.fn(),
    refresh: vi.fn(),
  },
  signIn: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: "user-1", email: "devotee@example.com" } },
    status: "authenticated",
  })),
  signIn,
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
  useTranslations: vi.fn((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      SettingsPage: {
        title: "Settings",
        description: "Change the password you use to sign in.",
        backToProfile: "← Back to profile",
        changePassword: "Change password",
        currentPasswordLabel: "Current password",
        currentPasswordPlaceholder: "Enter your current password",
        newPasswordLabel: "New password",
        newPasswordPlaceholder: "Enter a new password",
        confirmPasswordLabel: "Confirm new password",
        confirmPasswordPlaceholder: "Repeat the new password",
        passwordChanged: "Password changed successfully",
        passwordMismatch: "Passwords do not match",
        wrongPassword: "Current password is incorrect",
        passwordTooShort: "Password must be at least 8 characters",
        saveError: "Failed to change password",
        saving: "Saving...",
      },
    };
    return (key: string, values?: Record<string, string | number>) => {
      const value = messages[namespace]?.[key] ?? key;
      if (!values) return value;
      return Object.entries(values).reduce(
        (acc, [token, replacement]) => acc.replaceAll(`{${token}}`, String(replacement)),
        value,
      );
    };
  }),
}));

import SettingsPage from "@/app/[locale]/profile/settings/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn.mockResolvedValue({ ok: true });
  });

  it("renders labeled password inputs", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Change the password you use to sign in.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your current password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter a new password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Repeat the new password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change password" })).toBeInTheDocument();
  });

  it("re-authenticates with the new password after a successful change", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ) as any,
    );

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-secret" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "devotee@example.com",
        password: "new-secret123",
        redirect: false,
      });
      expect(router.refresh).toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent("Password changed successfully");
    });
  });

  it("trims whitespace before saving and reauthenticating", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock as any);

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-secret" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: " new-secret123 " } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: " new-secret123 " } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/users/user-1/password",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ currentPassword: "old-secret", newPassword: "new-secret123" }),
        }),
      );
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "devotee@example.com",
        password: "new-secret123",
        redirect: false,
      });
    });
  });
});
