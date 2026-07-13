import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inkai SBY — Solusi Digital Surabaya",
  description:
    "Inkai SBY menyediakan layanan website development, UI/UX design, dan branding digital di Surabaya, Indonesia.",
  openGraph: {
    title: "Inkai SBY — Solusi Digital Surabaya",
    description:
      "Partner digital terpercaya di Surabaya untuk website, desain, dan branding.",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} scroll-smooth antialiased`}
    >
      <body className="bg-ink-950 font-sans text-white">{children}</body>
    </html>
  );
}
