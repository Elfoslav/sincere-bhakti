"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const t = useTranslations("Auth.forgotPassword");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, language: locale }),
      });

      if (res.status === 429) {
        setError(t("tooManyRequests"));
        setLoading(false);
        return;
      }

      if (res.ok) {
        setSent(true);
      } else {
        setError(t("networkError"));
      }
    } catch {
      setError(t("networkError"));
    }
    setLoading(false);
  }

  return (
    <div className="w-full max-w-md">
      <Card variant="elevated">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪷</div>
          <h1 className="text-2xl font-bold text-deep">{t("title")}</h1>
          <p className="text-deep/60 text-sm mt-1">{t("subtitle")}</p>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-4 mb-4 text-center">
            {t("sent")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-deep mb-1">{t("emailLabel")}</label>
              <Input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
              />
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? t("loading") : t("button")}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-deep/60 mt-4">
          <Link href="/login" className="text-gold hover:underline font-medium">
            {t("backToLogin")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
