import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/utils";

/** Shared page hierarchy; callers supply already-translated copy. */
export default function PageHeader({ title, description, className }: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 min-w-0", className)}>
      <Heading as="h1">{title}</Heading>
      {description ? <p className="mt-3 text-muted-foreground leading-relaxed">{description}</p> : null}
    </header>
  );
}
