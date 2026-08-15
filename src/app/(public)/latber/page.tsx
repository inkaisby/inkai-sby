import type { Metadata } from "next";
import { LatberWalkInClient } from "@/components/latber/LatberWalkInClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pendaftaran Latihan Bersama",
  description:
    "Daftarkan anggota ke Latihan Bersama INKAI Surabaya — cari nama, scan kartu, atau tambah anggota baru.",
  robots: { index: true, follow: true },
};

type Props = {
  searchParams: Promise<{ period?: string }>;
};

export default async function LatberPublicPage({ searchParams }: Props) {
  const params = await searchParams;
  return <LatberWalkInClient initialPeriod={params.period ?? null} />;
}
