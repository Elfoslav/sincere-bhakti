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
        "font-heading text-foreground break-words",
        Tag === "h1" ? "type-title" : Tag === "h2" ? "text-xl" : "text-lg",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
