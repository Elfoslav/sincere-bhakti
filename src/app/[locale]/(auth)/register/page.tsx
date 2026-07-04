"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("Auth.register");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    router.push("/login?registered=true");
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-xl p-8 border border-sand">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪷</div>
          <h1 className="text-2xl font-bold text-deep">{t("title")}</h1>
          <p className="text-deep/60 text-sm mt-1">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-deep mb-1">{t("nameLabel")}</label>
            <p className="text-xs text-deep/50 mb-1.5">{t("nameHint")}</p>
            <Input
              name="name"
              type="text"
              required
              placeholder={t("namePlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-deep mb-1">{t("emailLabel")}</label>
            <Input
              name="email"
              type="email"
              required
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-deep mb-1">{t("passwordLabel")}</label>
            <Input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder={t("passwordPlaceholder")}
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

          <Button
            type="submit"
            variant="default"
            className="w-full"
            size="default"
            disabled={loading}
          >
            {loading ? t("loading") : t("button")}
          </Button>
        </form>

        <p className="text-center text-sm text-deep/60 mt-4">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-gold hover:underline font-medium">
            {t("loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
