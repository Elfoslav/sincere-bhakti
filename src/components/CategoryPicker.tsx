"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  CATEGORIES_MAX_PER_POST,
  CATEGORY_NAME_MAX_LENGTH,
  normalizeCategoryName,
} from "@/lib/validation";
import type { CategoryRef } from "@/types/category";

interface CategoryPickerProps {
  /** Canonical (Title Case) selected category names. */
  value: string[];
  onChange: (names: string[]) => void;
  max?: number;
  id?: string;
}

/**
 * Searchable category combobox with create-if-missing. Typing searches the
 * global taxonomy; when the normalized input matches nothing, a "Create"
 * row offers it (uniqueness is enforced server-side). Input is typed freely
 * and canonicalized to Title Case on select; multi-word names allowed.
 */
export default function CategoryPicker({ value, onChange, max = CATEGORIES_MAX_PER_POST, id }: CategoryPickerProps) {
  const t = useTranslations("Categories");
  const locale = useLocale();
  const [input, setInput] = useState("");
  const [results, setResults] = useState<CategoryRef[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const full = value.length >= max;

  useEffect(() => {
    if (!open) return;
    const query = input.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "10", language: locale });
        if (query) params.set("search", query);
        const res = await fetch(`/api/categories?${params}`, { signal: controller.signal });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        setResults(Array.isArray(data.categories) ? data.categories : []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, open, locale]);

  const normalized = normalizeCategoryName(input);
  const canCreate =
    !full &&
    normalized.length > 0 &&
    normalized.length <= CATEGORY_NAME_MAX_LENGTH &&
    !value.includes(normalized) &&
    !results.some((r) => r.name === normalized);
  // Options = matches (excluding already-selected) + optional create row.
  const options = results.filter((r) => !value.includes(r.name));

  function select(name: string) {
    if (value.includes(name) || value.length >= max) return;
    onChange([...value, name]);
    setInput("");
    setResults([]);
    setActiveIndex(-1);
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const total = options.length + (canCreate ? 1 : 0);
      if (total === 0) return;
      setActiveIndex((i) => (e.key === "ArrowDown" ? (i + 1) % total : (i - 1 + total) % total));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) select(options[activeIndex].name);
      else if (canCreate && activeIndex === options.length) select(normalized);
      else if (canCreate && options.length === 0) select(normalized);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node | null)) {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} onBlur={handleBlur} className="relative">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label={t("searchPlaceholder")}>
          {value.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-gold-light/25 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-deep"
            >
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={t("removeCategory", { name })}
                className="rounded-full p-0.5 text-deep/50 hover:text-deep"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        value={input}
        placeholder={t("searchPlaceholder")}
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-deep/15 bg-white px-3 py-2 text-sm text-deep placeholder:text-deep/40 focus:border-gold focus:outline-none"
      />
      {full && <p className="mt-1 text-xs text-deep/50">{t("maxReached", { max })}</p>}
      {open && (options.length > 0 || canCreate) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-deep/15 bg-white py-1 shadow-lg"
        >
          {options.map((option, i) => (
            <li
              key={option.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                select(option.name);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm font-semibold tracking-wide text-deep ${i === activeIndex ? "bg-gold-light/25" : ""}`}
            >
              {option.name}
            </li>
          ))}
          {canCreate && (
            <li
              id={`${listId}-${options.length}`}
              role="option"
              aria-selected={activeIndex === options.length}
              onMouseDown={(e) => {
                e.preventDefault();
                select(normalized);
              }}
              onMouseEnter={() => setActiveIndex(options.length)}
              className={`cursor-pointer px-3 py-2 text-sm text-saffron-dark ${activeIndex === options.length ? "bg-gold-light/25" : ""}`}
            >
              {t("createNew", { name: normalized })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
