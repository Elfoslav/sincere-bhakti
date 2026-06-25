import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXTAUTH_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  title: {
    default: "Sincere Bhakti — Gaudiya Vaishnavism Community",
    template: "%s | Sincere Bhakti",
  },
  description:
    "A spiritual community for devotees of Gaudiya Vaishnavism — share bhakti, inspire devotion. Post verses, realizations, and connect with the global saṅga.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    siteName: "Sincere Bhakti",
    title: "Sincere Bhakti — Gaudiya Vaishnavism Community",
    description:
      "A spiritual community for devotees of Gaudiya Vaishnavism — share bhakti, inspire devotion.",
    url: siteUrl,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sincere Bhakti — Gaudiya Vaishnavism Community",
    description:
      "A spiritual community for devotees of Gaudiya Vaishnavism — share bhakti, inspire devotion.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="bg-deep text-white/50 text-center text-sm py-4 border-t border-gold/20">
            <p>
              © 2026 🪷 Sincere Bhakti — Dedicated to the teachings of
              Śrīla Prabhupāda
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
