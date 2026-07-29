"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const t = useTranslations("Auth.verifyEmail");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // Derive the initial state from the token so we don't setState synchronously
  // inside the effect (which triggers a cascading render).
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const called = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (called.current) return;
    called.current = true;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (res.ok) setStatus("success");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="w-full max-w-md">
      <Card variant="elevated">
        <div className="text-center">
          {status === "loading" && (
            <>
              <div className="text-4xl mb-4">🪷</div>
              <h1 className="text-2xl font-bold text-deep">{t("title")}</h1>
              <p className="text-deep/60 text-sm mt-2">{t("verifying")}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-4xl mb-4">✅</div>
              <h1 className="text-2xl font-bold text-deep">{t("success")}</h1>
              <p className="text-deep/60 text-sm mt-2">{t("successDesc")}</p>
              <Button
                variant="default"
                className="w-full mt-6"
                onClick={() => window.location.href = "/login?verified=true"}
              >
                {t("signIn")}
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h1 className="text-2xl font-bold text-deep">{t("error")}</h1>
              <p className="text-deep/60 text-sm mt-2">{t("invalidToken")}</p>
              <Link
                href="/login"
                className="text-gold hover:underline font-medium text-sm mt-4 inline-block"
              >
                {t("signIn")}
              </Link>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
