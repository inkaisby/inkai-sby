# Tutorial video INKAI Surabaya

Paket skrip siap rekam untuk anggota dan pengurus. Video diunggah ke YouTube, lalu URL dimasukkan ke app.

## Seri anggota (publik + dashboard)

| Urutan | File | Judul YouTube saran |
|--------|------|---------------------|
| 01 | `anggota-01-pendaftaran.md` | INKAI SBY — Cara Daftar Anggota |
| 02 | `anggota-02-menu.md` | INKAI SBY — Mengenal Menu Dashboard |
| 03 | `anggota-03-ukt.md` | INKAI SBY — Cara Daftar UKT |
| 04 | `anggota-04-iuran.md` | INKAI SBY — Cara Lapor Iuran |
| 05 | `anggota-05-absensi.md` | INKAI SBY — Cara Absensi GPS |

Setelah upload, isi `youtubeUrl` di [`guide/member-tutorials.json`](../member-tutorials.json) untuk section yang sesuai (`pendaftaran`, `menu`, `ukt`, `iuran`, `absensi`). Redeploy agar embed muncul di:

- `/tutorial` (publik)
- `/dashboard/panduan` (anggota login)

Format URL yang didukung: `https://www.youtube.com/watch?v=…` atau `https://youtu.be/…`.

## Seri pengurus (hanya skrip, tanpa halaman app)

| Urutan | File | Judul YouTube saran |
|--------|------|---------------------|
| 01 | `pengurus-01-anggota.md` | INKAI SBY Pengurus — Verifikasi & Kelola Anggota |
| 02 | `pengurus-02-iuran.md` | INKAI SBY Pengurus — Verifikasi Iuran |
| 03 | `pengurus-03-ukt.md` | INKAI SBY Pengurus — Pendaftaran & Verifikasi UKT |
| 04 | `pengurus-04-absensi.md` | INKAI SBY Pengurus — Laporan Absensi |

Bagikan sebagai playlist internal pengurus (WA grup / Drive). Tidak perlu embed di situs publik.

## Checklist produksi umum

1. Pakai akun demo / data uji (bukan data sensitif anggota nyata).
2. Rekam di desktop 1080p atau HP portrait konsisten per seri.
3. Blur NIK/telepon/email di layar jika muncul data asli.
4. **Jangan** tampilkan nominal biaya UKT di rekaman sudut pandang anggota.
5. Durasi target 3–6 menit per episode.
