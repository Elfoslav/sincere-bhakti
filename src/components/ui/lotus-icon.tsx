import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Decorative brand ornament; the shared SVG mask inherits the semantic color. */
export default function LotusIcon({ className, ...props }: ComponentProps<"span">) {
  return <span {...props} aria-hidden="true" className={cn("lotus-icon inline-block size-8 shrink-0 align-middle text-primary", className)} />;
}
