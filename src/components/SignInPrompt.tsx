import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/** Compact guest prompt shared by each publishing surface. */
export default function SignInPrompt({ label, children, lead }: { label: string; children: ReactNode; lead?: string }) {
  return (
    <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
      {lead ? `${lead} ` : null}
      <Link href="/login" className="font-medium text-primary underline underline-offset-4">{label}</Link>{" "}
      {children}
    </p>
  );
}
