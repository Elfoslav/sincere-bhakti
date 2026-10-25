import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import LangSetter from "@/components/LangSetter";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

export default async function SiteLayout({ children, locale }: { children: ReactNode; locale: string }) {
  setRequestLocale(locale);

  const messages = await getMessages();
  const commonT = await getTranslations({ locale, namespace: "Common" });

  return (
    <div className="flex flex-col flex-1">
      <LangSetter locale={locale} />
      <NextIntlClientProvider messages={messages}>
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <Toaster position="bottom-right" richColors closeButton />
        <footer className="bg-background text-muted-foreground text-sm py-8 border-t border-border">
          <div className="site-container flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link href="/terms" className="transition-colors hover:text-primary">{commonT("terms")}</Link>
              <Link href="/privacy/krishna-chaitanya-mandir" className="transition-colors hover:text-primary">{commonT("privacy")}</Link>
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
