import { ShieldAlert } from "lucide-react";

/**
 * Ditampilkan menggantikan data anggota (profil/dokumen/prestasi/dst) saat
 * admin sedang mode ambil alih. Data "/me" Inkai selalu milik aktor (lihat
 * src/lib/inkai-api/member-data.ts) sehingga tidak boleh ditampilkan
 * seolah-olah data anggota target — lebih baik jujur kosong.
 */
export function ImpersonationDataNotice({
  title = "Tidak tersedia saat ambil alih",
  description = "Data akun Inkai (profil, dokumen, sabuk, kehadiran, tagihan) tidak dapat ditampilkan dalam mode ambil alih karena token API tetap milik akun pengurus, bukan akun target. Hentikan ambil alih untuk melihat data asli anggota.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-inkai-red/30 bg-inkai-red/5 p-4">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-inkai-red" />
      <div>
        <p className="font-semibold text-inkai-red">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
