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

export const metadata: Metadata = {
  title: "Sincere Bhakti",
  description:
    "A spiritual community for devotees of Gaudiya Vaishnavism — share bhakti, inspire devotion.",
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
