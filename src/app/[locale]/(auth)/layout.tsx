import type { Metadata } from "next";
import { getNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = getNoIndexMetadata();

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      {children}
    </div>
  );
}
