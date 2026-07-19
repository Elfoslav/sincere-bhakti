"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleUserRound, Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useIdentity } from "@/components/IdentityProvider";
import { getIdentitySubtitleKey } from "@/lib/identity-label";
import { cn } from "@/lib/utils";

interface IdentitySwitcherProps {
  compact?: boolean;
  mobileNav?: boolean;
  onSelect?: () => void;
}

export default function IdentitySwitcher({ compact = false, mobileNav = false, onSelect }: IdentitySwitcherProps) {
  const t = useTranslations("Identity");
  const { identities, activeIdentity, switchIdentity, loading } = useIdentity();
  const [open, setOpen] = useState(false);

  if (!activeIdentity || identities.length === 0) {
    return <IdentitySwitcherPlaceholder compact={compact} mobileNav={mobileNav} />;
  }

  async function handleSelect(channelId: string) {
    await switchIdentity(channelId);
    setOpen(false);
    onSelect?.();
  }

  return (
    <div className={cn("relative animate-in fade-in duration-300", mobileNav && "pointer-events-auto w-full max-w-44")}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 rounded-full border border-white/15 bg-white/10 text-left text-white transition-colors hover:bg-white/15",
          mobileNav && "h-9 w-full min-w-0 gap-2 border-white/10 pl-1 pr-3 text-white/85",
          compact && !mobileNav ? "w-full px-3 py-2" : "",
          !compact && !mobileNav ? "h-10 max-w-56 pl-1 pr-3" : "",
        )}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("switchLabel")}: ${activeIdentity.name}`}
      >
        {mobileNav ? (
          <CircleUserRound className="size-5 shrink-0 text-gold-light" aria-hidden="true" />
        ) : (
          <IdentityAvatar name={activeIdentity.name} avatarUrl={activeIdentity.avatarUrl} />
        )}
        <span className={cn("min-w-0", !mobileNav && "flex-1")}>
          {!compact && !mobileNav && (
            <span className="block text-[10px] uppercase text-white/55">
              {t("activeLabel")}
            </span>
          )}
          <span className="block truncate text-sm font-medium">{activeIdentity.name}</span>
        </span>
        <ChevronDown className={cn(mobileNav ? "size-3.5" : "size-4", "shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label={t("closeSwitcher")}
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />
          <div
            role="menu"
            className={cn(
              "z-30 mt-2 overflow-hidden rounded-lg border border-deep/10 bg-white text-deep shadow-xl",
              mobileNav && "fixed left-3 right-3 top-[4.25rem] mt-0",
              compact && !mobileNav ? "relative w-full" : "",
              !compact && !mobileNav ? "absolute right-0 w-72" : "",
            )}
          >
            <div className="border-b border-deep/10 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-deep/45">{t("switchLabel")}</p>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {identities.map((identity) => (
                <button
                  key={identity.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={identity.id === activeIdentity.id}
                  disabled={loading}
                  onClick={() => handleSelect(identity.id).catch(() => {})}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-sand/50 disabled:opacity-60"
                >
                  <IdentityAvatar name={identity.name} avatarUrl={identity.avatarUrl} dark />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{identity.name}</span>
                    <span className="block text-xs text-deep/45">
                      {t(getIdentitySubtitleKey(identity))}
                    </span>
                  </span>
                  {identity.id === activeIdentity.id && <Check className="size-4 text-tulsi" />}
                </button>
              ))}
            </div>
            <div className="border-t border-deep/10 p-2">
              <Link
                href="/profile"
                onClick={() => {
                  setOpen(false);
                  onSelect?.();
                }}
                className="block rounded-md px-3 py-2 text-sm text-deep/70 hover:bg-sand/50 hover:text-deep"
              >
                {t("manage")}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IdentitySwitcherPlaceholder({ compact = false, mobileNav = false }: { compact?: boolean; mobileNav?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 opacity-70",
        mobileNav && "h-9 w-full max-w-44 pl-1 pr-3",
        compact && !mobileNav ? "w-full px-3 py-2" : "",
        !compact && !mobileNav ? "h-10 w-56 pl-1 pr-3" : "",
      )}
    >
      <span className={cn("shrink-0 rounded-full bg-white/10", mobileNav ? "size-5" : "size-8")} />
      <span className={cn("min-w-0 flex-1", mobileNav ? "" : "space-y-1.5")}>
        {!compact && !mobileNav && <span className="block h-2 w-20 rounded-full bg-white/10" />}
        <span className={cn("block rounded-full bg-white/15", mobileNav ? "h-3 w-16" : "h-3 w-28")} />
      </span>
      <span className={cn("shrink-0 rounded-full bg-white/10", mobileNav ? "size-3.5" : "size-4")} />
    </div>
  );
}

function IdentityAvatar({ name, avatarUrl, dark = false }: { name: string; avatarUrl: string | null; dark?: boolean }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />;
  }

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        dark ? "bg-gold/20 text-gold" : "bg-white/15 text-gold-light",
      )}
    >
      {name ? name[0].toUpperCase() : <Hash className="size-4" />}
    </span>
  );
}
