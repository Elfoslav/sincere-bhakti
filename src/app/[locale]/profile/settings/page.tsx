"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heading } from "@/components/ui/heading";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiErrorCode } from "@/lib/api-error";
import { ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("SettingsPage");
  const common = useTranslations("Common");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const normalizedNewPassword = newPassword.trim();
    const normalizedConfirmPassword = confirmPassword.trim();

    if (normalizedNewPassword !== normalizedConfirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    if (normalizedNewPassword.length < PASSWORD_MIN_LENGTH) {
      setError(t("passwordTooShort", { min: PASSWORD_MIN_LENGTH }));
      return;
    }

    if (!session?.user?.id) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/users/${session.user.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: normalizedNewPassword }),
      });

      if (res.ok) {
        const email = session?.user?.email;
        if (!email) {
          setError(t("reauthFailed"));
          return;
        }

        const reauth = await signIn("credentials", {
          email,
          password: normalizedNewPassword,
          redirect: false,
        });

        if (reauth?.error || reauth?.ok === false) {
          setError(t("reauthFailed"));
          return;
        }

        router.refresh();
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429 || isApiErrorCode(data, ERROR_TOO_MANY_REQUESTS)) {
          setError(common("tooManyRequests"));
        } else if (data.error === "invalid_password") {
          setError(t("wrongPassword"));
        } else if (data.error?.startsWith("validation_error:")) {
          setError(t("passwordTooShort", { min: PASSWORD_MIN_LENGTH }));
        } else {
          setError(t("saveError"));
        }
      }
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!session?.user?.id) return null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 flex flex-col flex-1">
      <Link href="/profile" className="text-gold hover:text-gold-light transition-colors text-sm mb-6 inline-block">
        {t("backToProfile")}
      </Link>

      <Card variant="default" padding="lg" className="space-y-6">
        <div className="space-y-2">
          <Heading as="h1">{t("title")}</Heading>
          <p className="text-sm text-deep/60">{t("description")}</p>
        </div>

        {success && (
          <Alert variant="success">{t("passwordChanged")}</Alert>
        )}

        {error && <Alert variant="destructive">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-deep" htmlFor="currentPassword">
              {t("currentPasswordLabel")}
            </label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setError(""); }}
              placeholder={t("currentPasswordPlaceholder")}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-deep" htmlFor="newPassword">
              {t("newPasswordLabel")}
            </label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
              placeholder={t("newPasswordPlaceholder")}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              minLengthHint={PASSWORD_MIN_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-deep" htmlFor="confirmPassword">
              {t("confirmPasswordLabel")}
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
              placeholder={t("confirmPasswordPlaceholder")}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="min-w-32" disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
              {saving ? t("saving") : t("changePassword")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
