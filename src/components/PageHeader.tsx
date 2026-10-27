import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/utils";

/** Shared page hierarchy; callers supply already-translated copy. */
export default function PageHeader({ title, description, className, as = "h1", action, variant = "default" }: {
  as?: "h1" | "h2";
  action?: ReactNode;
  variant?: "default" | "editorial";
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("page-header mb-6 min-w-0", variant === "editorial" && "page-header-editorial", className)}>
      <div className="min-w-0 flex-1">
      <Heading as={as} className="type-title">{title}</Heading>
      {description ? <p className="mt-2 text-muted-foreground leading-relaxed">{description}</p> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}
