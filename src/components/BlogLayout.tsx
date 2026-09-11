"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function BlogLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const blogT = useTranslations("BlogPage");

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: blogT("title"), href: "/blog" },
          { label: title },
        ]}
        className="mb-6"
        lastClassName="text-lg"
      />

      {children}
    </div>
  );
}
