import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type CardPadding = "none" | "sm" | "md" | "lg" | "xl";
type CardVariant = "default" | "elevated" | "flat" | "hover" | "ghost" | "ghost-muted" | "editorial";

/** Surfaces share semantic tokens; editorial entries use whitespace and rules. */
const variantClasses: Record<CardVariant, string> = {
  default: "bg-card text-card-foreground rounded-lg border border-border",
  elevated: "bg-card text-card-foreground rounded-lg border border-border shadow-sm",
  flat: "bg-card text-card-foreground rounded-lg border border-border",
  hover: "bg-card text-card-foreground hover:bg-secondary rounded-lg border border-border transition-colors",
  ghost: "bg-card text-card-foreground rounded-lg border border-border",
  "ghost-muted": "bg-muted text-foreground rounded-lg border border-border",
  editorial: "bg-transparent border-b border-border rounded-none",
};

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
  xl: "p-8",
};

const defaultPadding: Record<CardVariant, CardPadding> = {
  default: "md",
  elevated: "xl",
  flat: "lg",
  hover: "sm",
  ghost: "none",
  "ghost-muted": "none",
  editorial: "none",
};

export function Card({
  variant = "default",
  padding,
  className,
  children,
  ...props
}: {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children?: ReactNode;
} & React.ComponentProps<"div">) {
  const p = padding ?? defaultPadding[variant];
  return (
    <div
      className={cn(variantClasses[variant], paddingClasses[p], className)}
      {...props}
    >
      {children}
    </div>
  );
}
