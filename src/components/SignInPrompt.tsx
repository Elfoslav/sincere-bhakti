import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/** Compact guest prompt shared by each publishing surface. */
export default function SignInPrompt({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">{label}</Link>{" "}
      {children}
    </p>
  );
}
