import * as React from "react";
import { AlertCircle, CircleCheckBig, Info } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100",
        success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100",
        destructive: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-100",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

function AlertIcon({ variant }: { variant: NonNullable<VariantProps<typeof alertVariants>["variant"]> }) {
  const iconClassName = "mt-0.5 size-4 shrink-0";

  if (variant === "success") {
    return <CircleCheckBig className={cn(iconClassName, "text-emerald-600")} />;
  }

  if (variant === "destructive") {
    return <AlertCircle className={cn(iconClassName, "text-red-600")} />;
  }

  return <Info className={cn(iconClassName, "text-blue-600")} />;
}

function Alert({
  className,
  variant = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <AlertIcon variant={variant} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export { Alert, alertVariants };
