import type { Metadata } from "next";
import { LatberWalkInClient } from "@/components/latber/LatberWalkInClient";
import {
  DEFAULT_LATBER_FEE,
  formatLatberCurrency,
  formatLatberPeriodLabel,
} from "@/lib/latber";
import { getLatberPublicPeriod } from "@/lib/latber-public";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ period?: string }>;
};

function formatMetaDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;
  try {
    const period = await getLatberPublicPeriod(params.period ?? null);
    const periodLabel = period.title
      ? formatLatberPeriodLabel(period.title)
      : "Latihan Bersama";
    const title = period.title
      ? `Pendaftaran Latihan Bersama — ${periodLabel}`
      : "Pendaftaran Latihan Bersama";
    const bits = [
      formatMetaDate(period.eventAt),
      period.eventLocation?.trim() || null,
      `Biaya ${formatLatberCurrency(period.feeAmount || DEFAULT_LATBER_FEE)}`,
    ].filter(Boolean);
    const description =
      bits.length > 0
        ? `Latihan Bersama INKAI Surabaya — ${bits.join(" · ")}. Daftar, bayar, dan cek status peserta di portal.`
        : "Daftarkan anggota ke Latihan Bersama INKAI Surabaya — cari nama, scan kartu, atau tambah anggota baru.";

    return {
      title,
      description,
      alternates: { canonical: "/latber" },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/latber`,
        type: "website",
        locale: "id_ID",
      },
    };
  } catch {
    return {
      title: "Pendaftaran Latihan Bersama",
      description:
        "Daftarkan anggota ke Latihan Bersama INKAI Surabaya — cari nama, scan kartu, atau tambah anggota baru.",
      alternates: { canonical: "/latber" },
      robots: { index: true, follow: true },
      openGraph: {
        title: "Pendaftaran Latihan Bersama | INKAI Surabaya",
        description:
          "Daftarkan anggota ke Latihan Bersama INKAI Surabaya.",
        url: `${SITE_URL}/latber`,
        type: "website",
        locale: "id_ID",
      },
    };
  }
}

export default async function LatberPublicPage({ searchParams }: Props) {
  const params = await searchParams;
  return <LatberWalkInClient initialPeriod={params.period ?? null} />;
}
