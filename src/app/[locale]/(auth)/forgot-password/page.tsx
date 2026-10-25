"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
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
        <title>{t("title")}</title>
        <div className="text-center mb-6">
          <div aria-hidden="true" className="text-4xl mb-2">🪷</div>
          <h1 className="type-section text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
        </div>

        {sent ? (
          <Alert variant="success" className="mb-4">
            {t("sent")}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-password-email" className="block text-sm font-medium text-deep mb-1">{t("emailLabel")}</label>
              <Input
                id="forgot-password-email"
              name="email"
                type="email"
                autoComplete="username"
                required
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
              />
            </div>

            {error && <Alert variant="destructive">{error}</Alert>}

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

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link href="/login" className="text-gold hover:underline font-medium">
            {t("backToLogin")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
