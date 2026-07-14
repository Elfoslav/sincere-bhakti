import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/url";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import LangSetter from "@/components/LangSetter";
import { Link } from "@/i18n/navigation";

const siteUrl = getSiteUrl();

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Omit<Props, "children">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: {
      default: t("home.title"),
      template: "%s | Sincere Bhakti",
    },
    description: t("home.description"),
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: "website" as const,
      siteName: "Sincere Bhakti",
      url: siteUrl,
      locale: locale === "en" ? "en_US" : locale === "cs" ? "cs_CZ" : "sk_SK",
      images: [{ url: "/images/sincere-bhakti-logo.png", width: 603, height: 414 }],
    },
    twitter: {
      card: "summary_large_image" as const,
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      languages: {
        en: siteUrl,
        cs: `${siteUrl}/cs`,
        sk: `${siteUrl}/sk`,
      },
    },
    icons: {
      icon: "/favicon.ico",
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  setRequestLocale(locale);

  const messages = await getMessages();
  const commonT = await getTranslations({ locale, namespace: "Common" });

  return (
    <div className="flex flex-col flex-1">
      <LangSetter locale={locale} />
      <NextIntlClientProvider messages={messages}>
        <style>{`:root{--navbar-height:4rem}`}</style>
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <Toaster position="bottom-right" richColors closeButton />
        <footer className="bg-deep text-white/50 text-sm py-4 border-t border-sand/20">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <Link
              href="/terms"
              className="hover:text-gold-light transition-colors order-first sm:order-none shrink-0"
            >
              {commonT("terms")}
            </Link>
            <div className="flex-1 text-center">
              <p>{commonT("footerLine1", { year: String(new Date().getFullYear()) })}</p>
              <p>{commonT("footerLine2")}</p>
            </div>
          </div>
        </footer>
      </NextIntlClientProvider>
    </div>
  );
}
