import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type CardPadding = "none" | "sm" | "md" | "lg" | "xl";
type CardVariant = "default" | "elevated" | "flat" | "hover" | "ghost" | "ghost-muted";

/* Dawn Sādhana: warm gold-tinted shadows instead of neutral grey ones. */
const variantClasses: Record<CardVariant, string> = {
  default: "bg-white rounded-2xl shadow-[0_2px_10px_rgba(120,90,30,0.07)] border border-sand",
  elevated: "bg-white rounded-2xl shadow-[0_6px_24px_rgba(120,90,30,0.12)] border border-sand",
  flat: "bg-white rounded-2xl border border-sand",
  hover: "bg-white hover:bg-sand/30 active:bg-sand/50 rounded-2xl border border-sand transition-colors",
  ghost: "bg-white rounded-2xl border border-sand",
  "ghost-muted": "bg-white/60 rounded-2xl border border-sand",
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
