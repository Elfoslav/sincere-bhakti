import { Geist, Marcellus } from "next/font/google";
import type { Viewport, Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Display serif for headings — the "Dawn Sādhana" voice. Self-hosted by
// next/font, so no external font request (CSP-safe). Marcellus is a
// single-weight (400) face; heading weight synthesis is disabled in
// globals.css so it always renders at its true weight. It lacks IAST dotted
// consonants (ṅ ṇ ṛ …), which fall back to the serif stack in --font-heading.
const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${marcellus.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
