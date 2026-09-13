"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { X } from "lucide-react";

/**
 * Active category-filter banner for feed pages. Shared by the timeline and
 * the blog listing so both stay visually consistent.
 */
function FilterBanner({ message, href, clearLabel }: { message: string; href: string; clearLabel: string }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2 text-sm">
      <span className="inline-flex items-center gap-2 rounded-full bg-gold-light/25 px-3 py-1 font-semibold text-deep">
        {message}
        <Link
          href={href}
          aria-label={clearLabel}
          className="rounded-full p-0.5 text-deep/50 hover:text-deep"
        >
          <X className="size-3.5" aria-hidden />
        </Link>
      </span>
    </div>
  );
}

export default function CategoryFilterBanner({ name, href }: { name: string; href: string }) {
  const t = useTranslations("Categories");
  return (
    <FilterBanner
      message={t("filteringByCategory", { name })}
      href={href}
      clearLabel={t("clearFilter")}
    />
  );
}

export function ChannelFilterBanner({ name, href }: { name: string; href: string }) {
  const t = useTranslations("Categories");
  return (
    <FilterBanner
      message={t("filteringByChannel", { name })}
      href={href}
      clearLabel={t("clearFilter")}
    />
  );
}
