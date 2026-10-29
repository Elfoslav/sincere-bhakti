"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { persistExplicitLocale } from "@/lib/locale-choice";
import { locales, localeFlags, localeNames, type Locale } from "@/i18n/routing";


export default function LanguageSwitcher({ fullWidth = false }: { fullWidth?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("Common");
  const menuId = useId();
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

  function toggle() {
    // Measure BEFORE opening so the first paint with open=true already has
    // the correct position. Measuring only in the effect below flashes the
    // dropdown at the initial pos (top:0/left:0) for one frame, then jumps it
    // under the button. Both updates batch into a single render.
    if (!open) measure();
    setOpen((p) => !p);
  }

  function switchLocale(next: Locale) {
    setOpen(false);
    // Freeze auto-detection from now on: the proxy resolves unprefixed URLs
    // from this cookie instead of the Accept-Language header.
    persistExplicitLocale(next);
    router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale: next });
  }

  const current = locales.includes(locale) ? locale : locales[0];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); btnRef.current?.focus(); }
      if (event.key === "Tab") setOpen(false);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const options = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const index = options.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowDown" ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
        options[next]?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-expanded={open}
        aria-label={t("language")}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onKeyDown={(event) => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); measure(); setOpen(true); requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus()); } }}
        className={cn(
          "flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-transparent hover:border-border min-h-10",
          fullWidth && "w-full min-h-11 justify-between border-border bg-muted text-foreground",
        )}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {fullWidth && <span className="text-muted-foreground">{t("language")}</span>}
          <span className="text-base leading-none">{localeFlags[current]}</span>
          <span className="text-sm font-medium">{localeNames[current]}</span>
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t("language")}
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
          className="fixed z-50 bg-popover rounded-lg shadow-lg border border-sand overflow-hidden"
        >
          {locales.map((code) => (
            <button
              key={code}
              role="menuitemradio"
              aria-checked={locale === code}
              onClick={() => { switchLocale(code); btnRef.current?.focus(); }}
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left transition-colors ${
                locale === code
                  ? "bg-secondary text-primary font-medium cursor-default"
                  : "text-deep hover:bg-sand/30"
              }`}
            >
              <span className="text-base leading-none">{localeFlags[code]}</span>
              <span>{localeNames[code]}</span>
              {locale === code && (
                <span className="ml-auto text-gold">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
