"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Heading } from "@/components/ui/heading";

export default function PostLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const postsT = useTranslations("PostsPage");

  return (
    <div className="reading-container page-space">
      <Heading as="h1" className="sr-only">{title}</Heading>
      <Breadcrumb
        items={[
          { label: postsT("title"), href: "/posts" },
          { label: title },
        ]}
        className="mb-6"
        lastClassName="text-lg"
      />

      {children}
    </div>
  );
}
