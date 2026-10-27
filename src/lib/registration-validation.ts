import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, emailField } from "@/lib/validation";

export function validateName(val: string, t: (key: string, vars?: Record<string, number>) => string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return t("nameRequired");
  if (trimmed.length > NAME_MAX_LENGTH) return t("nameTooLong", { max: NAME_MAX_LENGTH });
  return null;
}

export function validateEmail(val: string, t: (key: string, vars?: Record<string, number>) => string): string | null {
  const trimmed = val.trim().toLowerCase();
  if (!trimmed) return t("emailRequired");
  const parsed = emailField.safeParse(trimmed);
  if (!parsed.success) return t(parsed.error.issues[0]?.code === "too_big" ? "emailTooLong" : "emailInvalid");
  return null;
}

export function validatePassword(val: string, t: (key: string, vars?: Record<string, number>) => string): string | null {
  if (!val) return t("passwordRequired");
  if (val !== val.trim()) return t("passwordWhitespace");
  if (val.length < PASSWORD_MIN_LENGTH) return t("passwordTooShort", { min: PASSWORD_MIN_LENGTH });
  return null;
}
