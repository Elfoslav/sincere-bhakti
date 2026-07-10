"use client";

import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

export default function PostLayout({
  postId,
  title,
  backHref,
  backLabel,
  children,
}: {
  postId: string;
  title: string;
  backHref?: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        href={backHref ?? `/post/${postId}`}
        className="text-sm text-deep/50 hover:text-gold inline-block"
      >
        {backLabel}
      </Link>

      <h1 className="text-2xl font-bold text-deep">{title}</h1>

      {children}
    </div>
  );
}
