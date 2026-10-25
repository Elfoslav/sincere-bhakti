import { cn } from "@/lib/utils";

/**
 * Quiet lotus ornament between two brass hairlines: the devotional-journal
 * equivalent of a section break. Decorative only.
 */
export default function OrnamentDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center justify-center gap-3", className)}>
      <span className="h-px w-12 bg-primary/50" />
      <span className="text-xl leading-none">🪷</span>
      <span className="h-px w-12 bg-primary/50" />
    </div>
  );
}
