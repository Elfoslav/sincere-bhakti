import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3";

export function Heading({
  as: Tag = "h2",
  className,
  children,
}: {
  as?: HeadingLevel;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "font-heading text-deep",
        Tag === "h1" ? "text-2xl font-bold" : Tag === "h2" ? "text-xl font-semibold" : "text-lg font-medium",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
