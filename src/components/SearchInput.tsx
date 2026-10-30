"use client";

import { useRef } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);

  function clear() {
    onChange("");
    inputRef.current?.focus();
  }
  return (
    <div className={cn("relative group", className)}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
        <Search className="w-4 h-4 text-muted-foreground/60 group-focus-within:text-gold transition-colors" />
      </div>
      <input
        ref={inputRef}
        type="text"
        enterKeyHint="search"
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            clear();
          }
        }}
        role="searchbox"
        aria-label={placeholder}
        aria-busy={loading}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-lg border border-input bg-card pl-10",
          value && loading ? "pr-20" : "pr-12",
          "text-base md:text-sm text-foreground",
          "transition-all duration-200 outline-none",
          "focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-1">
        {loading && <Loader2 className="size-4 text-muted-foreground animate-spin" aria-hidden="true" />}
        {value ? (
          <Button
            type="button"
            onClick={clear}
            variant="icon-destructive"
            size="icon-lg"
            className="size-11 text-muted-foreground/60"
            aria-label={t("clearSearch")}
            icon={<X />}
          />
        ) : null}
      </div>
    </div>
  );
}
