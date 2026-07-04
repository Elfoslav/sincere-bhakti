"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ChevronDown } from "lucide-react";

const locales = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "cs", label: "CS", flag: "🇨🇿" },
  { code: "sk", label: "SK", flag: "🇸🇰" },
] as const;

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 128) });
    }
  }, []);

  useEffect(() => {
    if (open) {
      measure();
      window.addEventListener("scroll", measure, true);
      window.addEventListener("resize", measure);
      return () => {
        window.removeEventListener("scroll", measure, true);
        window.removeEventListener("resize", measure);
      };
    }
  }, [open, measure]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLocale(next: string) {
    setOpen(false);
    router.replace(pathname, { locale: next });
  }

  const current = locales.find((l) => l.code === locale) ?? locales[0];

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors px-2 py-1.5 rounded-md border border-white/10 hover:border-white/20"
      >
        <span className="leading-none">{current.flag}</span>
        <span className="text-xs font-medium uppercase">{current.label}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-sand overflow-hidden"
        >
          {locales.map((l) => (
            <button
              key={l.code}
              onClick={() => switchLocale(l.code)}
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left transition-colors ${
                locale === l.code
                  ? "bg-gold/10 text-gold font-medium cursor-default"
                  : "text-deep hover:bg-sand/30"
              }`}
            >
              <span className="leading-none">{l.flag}</span>
              <span>{l.label}</span>
              {locale === l.code && (
                <span className="ml-auto text-gold">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
