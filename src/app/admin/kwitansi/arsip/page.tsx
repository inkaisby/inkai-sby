import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { formatRp } from "@/lib/terbilang";

export const dynamic = "force-dynamic";

/** Wireframe dummy — belum persist PaymentReceipt. */
const DUMMY_ROWS = [
  {
    no: "KW/2026/08/0001",
    periodeNama: "Iuran Agustus 2026",
    jenis: "Iuran/tagihan",
    tanggal: "10 Agustus 2026",
    total: 1_500_000,
    scope: "Ranting Contoh",
  },
  {
    no: "KW/2026/08/0002",
    periodeNama: "Walikota Cup 2026",
    jenis: "Prestasi/hadiah",
    tanggal: "12 Agustus 2026",
    total: 3_000_000,
    scope: "Cabang Surabaya",
  },
  {
    no: "NP/2026/08/0001",
    periodeNama: "Konsumsi panitia",
    jenis: "Pengeluaran event",
    tanggal: "14 Agustus 2026",
    total: 750_000,
    scope: "Cabang Surabaya",
  },
] as const;

export default function AdminKwitansiArsipPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <AdminKwitansiArsipContent />
    </Suspense>
  );
}

async function AdminKwitansiArsipContent() {
  const { user, adminDojoGrants } = await requireAdminSession();
  if (
    !canAccessAdminPath(
      user.roles ?? [],
      "/admin/kwitansi/arsip",
      adminDojoGrants,
    )
  ) {
    redirect(adminFallbackPath(user.roles ?? [], adminDojoGrants));
  }

  return (
    <>
      <AdminPageHeader
        title="Arsip Kwitansi"
        description="Riwayat cetak (wireframe). Persist ke server = fase 2."
      />
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Contoh — belum tersimpan ke server. Data di bawah hanya contoh UI.
      </div>
      <div className="mb-4 flex justify-end">
        <Button asChild className="bg-inkai-red hover:bg-inkai-red/90">
          <Link href="/admin/kwitansi">Buat kwitansi</Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-3">No</th>
              <th className="p-3">Periode / Nama</th>
              <th className="p-3">Jenis</th>
              <th className="p-3">Tanggal</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Scope</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_ROWS.map((row) => (
              <tr key={row.no} className="border-b">
                <td className="p-3 font-medium">{row.no}</td>
                <td className="p-3">{row.periodeNama}</td>
                <td className="p-3">{row.jenis}</td>
                <td className="p-3">{row.tanggal}</td>
                <td className="p-3 text-right">{formatRp(row.total)}</td>
                <td className="p-3">{row.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Empty state nyata akan muncul setelah arsip tersimpan (fase 2).
      </p>
    </>
  );
}
