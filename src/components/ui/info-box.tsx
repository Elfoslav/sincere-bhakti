import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type InfoBoxVariant = "info" | "warning" | "error" | "success";

const variantClasses: Record<InfoBoxVariant, string> = {
  info:
    "border-blue-200 bg-blue-50 text-blue-800",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800",
  error:
    "border-red-200 bg-red-50 text-red-700",
  success:
    "border-green-200 bg-green-50 text-green-700",
};

const iconMap: Record<InfoBoxVariant, string> = {
  info: "ℹ️",
  warning: "⚠️",
  error: "❌",
  success: "✅",
};

export function InfoBox({
  variant = "info",
  icon,
  title,
  children,
  className,
  action,
}: {
  variant?: InfoBoxVariant;
  icon?: string;
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 text-sm leading-relaxed flex flex-col gap-2",
        variantClasses[variant],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5">{icon ?? iconMap[variant]}</span>
        <div className="min-w-0 flex-1">
          {title && (
            <p className="font-semibold mb-1">{title}</p>
          )}
          <div>{children}</div>
        </div>
      </div>
      {action && (
        <div className="ml-8">
          {action}
        </div>
      )}
    </div>
  );
}
