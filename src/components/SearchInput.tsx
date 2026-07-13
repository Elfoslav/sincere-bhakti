"use client";

import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  loading = false,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative group", className)}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
        <Search className="w-4 h-4 text-muted-foreground/60 group-focus-within:text-gold transition-colors" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border border-input bg-white pl-10 pr-10",
          "text-sm text-foreground placeholder:text-muted-foreground/50",
          "transition-all duration-200 outline-none",
          "focus-visible:border-gold focus-visible:ring-3 focus-visible:ring-gold/15",
          "shadow-sm hover:shadow-md focus-visible:shadow-md",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
        {loading ? (
          <Loader2 className="w-4 h-4 text-muted-foreground/40 animate-spin" />
        ) : value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-0.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}