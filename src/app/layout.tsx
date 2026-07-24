import { Geist } from "next/font/google";
import localFont from "next/font/local";
import type { Viewport, Metadata } from "next";
import { cookies } from "next/headers";
import Providers from "@/components/Providers";
import { auth } from "@/lib/auth";
import { ACTIVE_IDENTITY_COOKIE } from "@/lib/active-identity";
import { resolveActiveIdentityState } from "@/lib/identity";
import { getAuthorableChannels } from "@/lib/services/channel";
import type { InitialIdentityState } from "@/types/identity";
import { routing } from "@/i18n/routing";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Display serif for headings — the "Dawn Sādhana" voice. This is Marcellus
// patched with the Sanskrit/IAST dotted glyphs it lacked (ṅ ṇ ṛ ṣ ṭ ḍ ṁ ṃ ḥ
// ḷ + capitals), composed from its own base letters and dot, and renamed
// "Sincere Bhakti" per the OFL Reserved Font Name clause. Regenerate via
// scripts/heading-font/. Single weight (400) — heading weight synthesis is
// disabled in globals.css so `font-bold` utilities render at true weight.
const headingFont = localFont({
  src: "./fonts/SincereBhakti-Regular.woff2",
  variable: "--font-heading-face",
  weight: "400",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1a2e",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  icons: { icon: "/favicon.ico" },
};

async function getInitialIdentityState(userId: string, locale: string, fallbackChannelId?: string): Promise<InitialIdentityState | null> {
  try {
    const [cookieStore, identities] = await Promise.all([
      cookies(),
      getAuthorableChannels(userId, locale),
    ]);

    return resolveActiveIdentityState({
      userId,
      identities,
      preferredChannelId: cookieStore.get(ACTIVE_IDENTITY_COOKIE)?.value,
      fallbackChannelId,
    });
  } catch (error) {
    console.error("Failed to load initial identity state", error);
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? routing.defaultLocale;

  const initialIdentityState = session?.user?.id
    ? await getInitialIdentityState(session.user.id, locale, session.user.channelId)
    : null;

  return (
    <html lang="en" className={`${geistSans.variable} ${headingFont.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers session={session} initialIdentityState={initialIdentityState} locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
