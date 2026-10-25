import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Fraction of the limit at which the meter turns to the warning color. */
const WARN_AT = 0.9;

/**
 * Selected-upload size vs. its limit: a size caption plus a thin meter that
 * switches from brass to the destructive role near the limit. Shared by the
 * post and album forms (was duplicated inline with hardcoded hex colors).
 */
export default function UploadSizeMeter({ used, max, className }: { used: number; max: number; className?: string }) {
  if (used <= 0) return null;
  const nearLimit = used > max * WARN_AT;
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatBytes(used)} / {formatBytes(max)}
      </span>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(used, max)}
        aria-valuetext={`${formatBytes(used)} / ${formatBytes(max)}`}
        className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", nearLimit ? "bg-destructive" : "bg-primary")}
          style={{ width: `${Math.min((used / max) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
