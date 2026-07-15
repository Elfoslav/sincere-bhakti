"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { useFormPersist } from "@/lib/hooks/useFormPersist";

function validateName(val: string, t: (key: string, vars?: Record<string, number>) => string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return t("nameRequired");
  if (trimmed.length < 2) return t("nameTooShort", { min: 2 });
  if (trimmed.length > 50) return t("nameTooLong", { max: 50 });
  return null;
}

function validateEmail(val: string, t: (key: string, vars?: Record<string, number>) => string): string | null {
  const trimmed = val.trim().toLowerCase();
  if (!trimmed) return t("emailRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return t("emailInvalid");
  if (trimmed.length > 255) return t("emailTooLong");
  return null;
}

function validatePassword(val: string, t: (key: string, vars?: Record<string, number>) => string): string | null {
  if (!val) return t("passwordRequired");
  if (val !== val.trim()) return t("passwordWhitespace");
  if (val.length < PASSWORD_MIN_LENGTH) return t("passwordTooShort", { min: PASSWORD_MIN_LENGTH });
  return null;
}

type FieldErrors = {
  name: string | null;
  email: string | null;
  password: string | null;
  terms: string | null;
};

const initialErrors: FieldErrors = { name: null, email: null, password: null, terms: null };

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("Auth.register");
  const [errors, setErrors] = useState<FieldErrors>(initialErrors);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { stored, save, clear, loaded } = useFormPersist<{ name: string; email: string }>("register", ["password"]);

  const validators = useMemo(() => ({
    name: (val: string) => validateName(val, t),
    email: (val: string) => validateEmail(val, t),
    password: (val: string) => validatePassword(val, t),
  }), [t]);

  function handleBlur(field: "name" | "email" | "password") {
    return (e: React.FocusEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const err = validators[field](val);
      setErrors((prev) => ({ ...prev, [field]: err }));
      if (!err) save({ [field]: val });
    };
  }

  function handleChange(field: "name" | "email") {
    return () => {
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    };
  }

  function handleServerError(err: string) {
    setServerError(err);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");

    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const nameErr = validators.name(name);
    const emailErr = validators.email(email);
    const passwordErr = validators.password(password);
    const termsErr = termsAgreed ? null : t("termsRequired");
    setErrors({ name: nameErr, email: emailErr, password: passwordErr, terms: termsErr });

    if (nameErr || emailErr || passwordErr || termsErr) return;

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, terms: true }),
      });

      if (!res.ok) {
        if (res.status === 409) {
          setErrors((prev) => ({ ...prev, name: t("nameTaken") }));
        } else if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          if (data.error === "validation_error:name:too_big") {
            setErrors((prev) => ({ ...prev, name: t("nameTooLong", { max: 50 }) }));
          } else if (data.error === "validation_error:name:too_small") {
            setErrors((prev) => ({ ...prev, name: t("nameRequired") }));
          } else if (data.error === "validation_error:email:invalid_string") {
            setErrors((prev) => ({ ...prev, email: t("emailInvalid") }));
          } else if (data.error?.startsWith("validation_error:")) {
            handleServerError(t("registrationFailed"));
          } else {
            handleServerError(t("registrationFailed"));
          }
        } else {
          handleServerError(t("registrationFailed"));
        }
        setLoading(false);
        return;
      }
    } catch {
      handleServerError(t("networkError"));
      setLoading(false);
      return;
    }

    clear();
    router.push("/login?registered=true");
  }

  // Restore persisted values after mount
  useEffect(() => {
    if (!loaded || !stored || !formRef.current) return;
    const form = formRef.current;
    const nameInput = form.elements.namedItem("name") as HTMLInputElement | null;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
    if (nameInput && stored.name) nameInput.value = stored.name;
    if (emailInput && stored.email) emailInput.value = stored.email;
  }, [loaded, stored]);

  return (
    <div className="w-full max-w-md">
      <Card variant="elevated">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪷</div>
          <h1 className="text-2xl font-bold text-deep">{t("title")}</h1>
          <p className="text-deep/60 text-sm mt-1">{t("subtitle")}</p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-deep mb-1">{t("nameLabel")}</label>
            <p className="text-xs text-deep/50 mb-1.5">{t("nameHint")}</p>
            <Input
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder={t("namePlaceholder")}
              onBlur={handleBlur("name")}
              onChange={handleChange("name")}
              maxLength={50}
              minLengthHint={2}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-deep mb-1">{t("emailLabel")}</label>
            <Input
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder={t("emailPlaceholder")}
              onBlur={handleBlur("email")}
              onChange={handleChange("email")}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-deep mb-1">{t("passwordLabel")}</label>
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              placeholder={t("passwordPlaceholder")}
              onBlur={handleBlur("password")}
              onChange={() => errors.password && setErrors((prev) => ({ ...prev, password: null }))}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(e) => { setTermsAgreed(e.target.checked); if (errors.terms) setErrors((prev) => ({ ...prev, terms: null })); }}
              className="mt-0.5 h-4 w-4 rounded border-deep/30 text-gold focus:ring-gold"
            />
            <span className="text-sm text-deep/70">
              {t.rich("termsAgreement", {
                link: (chunks) => (
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline font-medium">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {errors.terms && <p className="text-red-500 text-xs -mt-2">{errors.terms}</p>}

          {serverError && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{serverError}</p>}

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
      </Card>
    </div>
  );
}