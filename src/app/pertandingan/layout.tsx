import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kejuaraan & Pertandingan Karate — INKAI Surabaya",
  description:
    "Portal Resmi Kejuaraan Karate INKAI Surabaya. Hari/Tanggal: Minggu, 04 Oktober 2026 | Pukul: 08.00 – 12.00 WIB | Tempat: Gedung Olahraga Kodam V/Brawijaya Surabaya. Lihat sekilas keterangan pertandingan, ketentuan resmi, daftar atlet terdaftar, dan kategori kelas.",
  keywords: [
    "Kejuaraan Karate INKAI Surabaya",
    "Pertandingan Karate Surabaya",
    "Ketentuan Pertandingan Karate",
    "Daftar Atlet INKAI",
    "GOR Kodam V Brawijaya",
    "INKAI Surabaya",
  ],
  openGraph: {
    title: "Kejuaraan & Pertandingan Karate INKAI Surabaya",
    description:
      "Minggu, 04 Oktober 2026 | Pukul: 08.00 – 12.00 WIB | GOR Kodam V/Brawijaya, Surabaya. Portal Informasi, Daftar Atlet, Kategori Kelas & Ketentuan Pertandingan Karate.",
    url: "https://inkai-sby.vercel.app/pertandingan",
    siteName: "INKAI Surabaya",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kejuaraan & Pertandingan Karate INKAI Surabaya",
    description:
      "Minggu, 04 Oktober 2026 | Pukul: 08.00 – 12.00 WIB | GOR Kodam V/Brawijaya Surabaya. Lihat sekilas ketentuan pertandingan & daftar atlet.",
  },
};

export default function PertandinganLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
