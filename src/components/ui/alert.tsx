import * as React from "react";
import { AlertCircle, CircleCheckBig, Info } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { feedbackContainerClasses, feedbackIconClasses } from "@/components/ui/feedback-palette";

const alertVariants = cva(
  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: feedbackContainerClasses.info,
        success: feedbackContainerClasses.success,
        destructive: feedbackContainerClasses.destructive,
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

function AlertIcon({ variant }: { variant: NonNullable<VariantProps<typeof alertVariants>["variant"]> }) {
  const iconClassName = cn("size-4 shrink-0 self-center", feedbackIconClasses[variant]);

  if (variant === "success") {
    return <CircleCheckBig className={iconClassName} />;
  }

  if (variant === "destructive") {
    return <AlertCircle className={iconClassName} />;
  }

  return <Info className={iconClassName} />;
}

function Alert({
  className,
  variant = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const iconVariant = variant ?? "info";

  return (
    <div
      role={iconVariant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant: iconVariant }), className)}
      {...props}
    >
      <AlertIcon variant={iconVariant} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export { Alert, alertVariants };
