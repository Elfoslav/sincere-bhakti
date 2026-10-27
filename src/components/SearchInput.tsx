"use client";

import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  loading?: boolean;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder,
  loading = false,
  className,
}: SearchInputProps) {
  const t = useTranslations("Common");
  return (
    <div className={cn("relative group", className)}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
        <Search className="w-4 h-4 text-muted-foreground/60 group-focus-within:text-gold transition-colors" />
      </div>
      <input
        type="text"
        role="searchbox"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-lg border border-input bg-card pl-10 pr-10",
          "text-sm text-foreground",
          "transition-all duration-200 outline-none",
          "focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
        {loading ? (
          <Loader2 className="w-4 h-4 text-muted-foreground/40 animate-spin" />
        ) : value ? (
          <Button
            type="button"
            onClick={() => onChange("")}
            variant="icon-destructive"
            size="icon-xs"
            className="text-muted-foreground/40"
            aria-label={t("clearSearch")}
            icon={<X />}
          />
        ) : null}
      </div>
    </div>
  );
}
