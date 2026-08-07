import { cn } from "@/lib/utils";
import { CircleCheckBig, CircleX, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { feedbackContainerClasses, feedbackIconClasses } from "@/components/ui/feedback-palette";

type InfoBoxVariant = "info" | "warning" | "error" | "success";

const variantClasses: Record<InfoBoxVariant, string> = {
  info: feedbackContainerClasses.info,
  warning: feedbackContainerClasses.warning,
  error: feedbackContainerClasses.error,
  success: feedbackContainerClasses.success,
};

const iconClasses: Record<InfoBoxVariant, string> = {
  info: feedbackIconClasses.info,
  warning: feedbackIconClasses.warning,
  error: feedbackIconClasses.error,
  success: feedbackIconClasses.success,
};

function InfoBoxIcon({ variant }: { variant: NonNullable<InfoBoxVariant> }) {
  const className = cn("size-4 shrink-0 self-center", iconClasses[variant]);

  if (variant === "success") {
    return <CircleCheckBig className={className} />;
  }

  if (variant === "error") {
    return <CircleX className={className} />;
  }

  if (variant === "warning") {
    return <TriangleAlert className={className} />;
  }

  return <Info className={className} />;
}

export function InfoBox({
  variant = "info",
  icon,
  title,
  children,
  className,
  action,
  onClose,
  closeLabel,
}: {
  variant?: InfoBoxVariant;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-sm",
        variantClasses[variant],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5">{icon ?? <InfoBoxIcon variant={variant} />}</span>
        <div className="min-w-0 flex-1">
          {title && (
            <p className="font-semibold mb-1">{title}</p>
          )}
          <div>{children}</div>
          {action && (
            <div className="mt-2">{action}</div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100 hover:bg-black/5"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
