"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormPersist } from "@/lib/hooks/useFormPersist";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Auth.login");
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { stored, save, clear, loaded } = useFormPersist<{ email: string }>("login", ["password"]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

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
      <div className="bg-white rounded-lg shadow-xl p-8 border border-sand">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪷</div>
          <h1 className="text-2xl font-bold text-deep">{t("title")}</h1>
          <p className="text-deep/60 text-sm mt-1">{t("subtitle")}</p>
        </div>

        {justRegistered && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 mb-4 text-center">
            {t("registeredSuccess")}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-deep mb-1">{t("emailLabel")}</label>
            <Input
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
            <label className="block text-sm font-medium text-deep mb-1">{t("passwordLabel")}</label>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder={t("passwordPlaceholder")}
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

          <Button type="submit" variant="default" className="w-full" disabled={loading}>
            {loading ? t("loading") : t("button")}
          </Button>
        </form>

        <p className="text-center text-sm text-deep/60 mt-4">
          {t("noAccount")}{" "}
          <Link href="/register" className="text-gold hover:underline font-medium">
            {t("registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}