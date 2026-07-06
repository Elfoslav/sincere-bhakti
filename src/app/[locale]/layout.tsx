import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXTAUTH_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000");

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
    <html
      lang={locale}
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Toaster position="bottom-right" richColors closeButton />
            <footer className="bg-deep text-white/50 text-center text-sm py-4 border-t border-sand/20">
              <p>
                {commonT("footerCopyright", { year: String(new Date().getFullYear()) })}
              </p>
            </footer>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
