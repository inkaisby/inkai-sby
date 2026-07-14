import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import { SITE_URL } from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "INKAI Surabaya — Institut Karate-Do Indonesia",
    template: "%s | INKAI Surabaya",
  },
  description:
    "Website resmi INKAI Cabang Surabaya. Institut Karate-Do Indonesia — Integritas, Tangguh, Rendah Hati.",
  openGraph: {
    title: "INKAI Surabaya",
    description: "Institut Karate-Do Indonesia — Cabang Surabaya",
    locale: "id_ID",
    type: "website",
    url: SITE_URL,
    images: [{ url: "/logo-inkai.png", width: 512, height: 512, alt: "INKAI Surabaya" }],
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
