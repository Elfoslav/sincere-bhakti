import type { Metadata } from "next";
import { getNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = getNoIndexMetadata();

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-8">
      {children}
    </div>
  );
}
