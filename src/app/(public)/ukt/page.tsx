import type { Metadata } from "next";
import { UktPublicRosterClient } from "@/components/ukt/UktPublicRosterClient";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar Peserta UKT",
  description:
    "Daftar peserta Ujian Kenaikan Tingkat INKAI Surabaya (periode aktif) — status dan Kyu Baru mengikuti data admin.",
  alternates: { canonical: "/ukt" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Daftar Peserta UKT | INKAI Surabaya",
    description:
      "Lihat daftar peserta UKT periode aktif Cabang Surabaya.",
    url: `${SITE_URL}/ukt`,
    type: "website",
    locale: "id_ID",
  },
};

export default function UktPublicPage() {
  return <UktPublicRosterClient />;
}
