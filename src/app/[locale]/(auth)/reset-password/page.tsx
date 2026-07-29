"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

export default function ResetPasswordPage() {
  const t = useTranslations("Auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.status === 429) {
        setError(t("tooManyRequests"));
        setLoading(false);
        return;
      }

      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "invalid_verification_token" || data.error === "expired_verification_token") {
          setError(t("invalidToken"));
        } else {
          setError(t("serverError"));
        }
      }
    } catch {
      setError(t("serverError"));
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <Card variant="elevated">
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-deep">{t("title")}</h1>
            <p className="text-deep/60 text-sm mt-2">{t("invalidToken")}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <Card variant="elevated">
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-deep">{t("success")}</h1>
            <p className="text-deep/60 text-sm mt-2">{t("successDesc")}</p>
            <Button
              variant="default"
              className="w-full mt-6"
              onClick={() => router.push("/login")}
            >
              {t("signIn")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <Card variant="elevated">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪷</div>
          <h1 className="text-2xl font-bold text-deep">{t("title")}</h1>
          <p className="text-deep/60 text-sm mt-1">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-deep mb-1">{t("passwordLabel")}</label>
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

          <Button
            type="submit"
            variant="default"
            className="w-full"
            disabled={loading || password.length < PASSWORD_MIN_LENGTH}
          >
            {loading ? t("loading") : t("button")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
