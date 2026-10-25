import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import LangSetter from "@/components/LangSetter";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

// Underlined so footer links are identifiable without relying on color alone.
const footerLinkClassName =
  "underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary";

export default async function SiteLayout({ children, locale }: { children: ReactNode; locale: string }) {
  setRequestLocale(locale);

  const messages = await getMessages();
  const commonT = await getTranslations({ locale, namespace: "Common" });

  return (
    <div className="flex flex-col flex-1">
      <LangSetter locale={locale} />
      <NextIntlClientProvider messages={messages}>
        {/* First tab stop: lets keyboard and screen-reader users bypass the navigation. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-3 focus:ring-ring/40"
        >
          {commonT("skipToContent")}
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">{children}</main>
        <Toaster position="bottom-right" richColors closeButton />
        <footer className="bg-background text-muted-foreground text-sm py-8 border-t border-border">
          <div className="site-container flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link href="/terms" className={footerLinkClassName}>{commonT("terms")}</Link>
              <Link href="/privacy/krishna-chaitanya-mandir" className={footerLinkClassName}>{commonT("privacy")}</Link>
            </div>
            <div className="text-center sm:text-right">
              <p>{commonT("footerLine1", { year: String(new Date().getFullYear()) })}</p>
              <p>{commonT("footerLine2")}</p>
            </div>
          </div>
        </footer>
      </NextIntlClientProvider>
    </div>
  );
}
