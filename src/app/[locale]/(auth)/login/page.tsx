"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { AUTH_EMAIL_PERSIST_KEY } from "@/lib/form-persist-keys";
import { useFormPersist } from "@/lib/hooks/useFormPersist";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Auth.login");
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";
  const justVerified = searchParams.get("verified") === "true";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { stored, save, clear, loaded } = useFormPersist<{ email: string }>(AUTH_EMAIL_PERSIST_KEY, ["password"]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    save({ email });

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("error"));
        setLoading(false);
      } else {
        clear();
        router.push("/posts");
        router.refresh();
      }
    } catch {
      setError(t("networkError"));
      setLoading(false);
    }
  }

  // Restore persisted email after mount
  useEffect(() => {
    if (!loaded || !stored?.email || !formRef.current) return;
    const input = formRef.current.elements.namedItem("email") as HTMLInputElement | null;
    if (input) input.value = stored.email;
  }, [loaded, stored]);

  return (
    <div className="w-full max-w-md">
      <Card variant="elevated">
        <title>{t("title")}</title>
        <div className="text-center mb-6">
          <div aria-hidden="true" className="text-4xl mb-2">🪷</div>
          <h1 className="type-section text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
        </div>

        {justRegistered && (
          <Alert variant="success" className="mb-4">
            {t("registeredVerify")}
          </Alert>
        )}

        {justVerified && (
          <Alert variant="success" className="mb-4">
            {t("verifiedSuccess")}
          </Alert>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-deep mb-1">{t("emailLabel")}</label>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder={t("emailPlaceholder")}
              onBlur={(e) => e.target.value && save({ email: e.target.value })}
              onChange={() => error && setError("")}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-deep mb-1">{t("passwordLabel")}</label>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder={t("passwordPlaceholder")}
            />
            <div className="text-right mt-1">
              <Link href="/forgot-password" className="text-xs text-gold hover:underline font-medium">
                {t("forgotPassword")}
              </Link>
            </div>
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          <Button type="submit" variant="default" className="w-full" disabled={loading}>
            {loading ? t("loading") : t("button")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {t("noAccount")}{" "}
          <Link href="/register" className="text-gold hover:underline font-medium">
            {t("registerLink")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
