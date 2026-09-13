"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function BlogLayout({
  title,
  children,
  containerClassName = "w-full max-w-3xl mx-auto px-4 py-8",
}: {
  title: string;
  children: ReactNode;
  containerClassName?: string;
}) {
  const blogT = useTranslations("BlogPage");

  return (
    <div className={containerClassName}>
      <Breadcrumb
        items={[
          { label: blogT("title"), href: "/blog" },
          { label: title },
        ]}
        className="mb-6"
        lastClassName="max-w-[240px] truncate text-sm font-normal"
      />

      {children}
    </div>
  );
}
