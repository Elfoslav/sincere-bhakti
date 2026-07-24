import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface BreadcrumbProps extends ComponentProps<"nav"> {
  items: BreadcrumbItem[];
  lastClassName?: string;
}

export function Breadcrumb({ items, className, lastClassName, ...props }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm text-deep/60", className)} {...props}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-4 h-4 text-deep/30" aria-hidden />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-gold-light transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? "text-deep font-semibold" : "", isLast ? lastClassName : "")}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
