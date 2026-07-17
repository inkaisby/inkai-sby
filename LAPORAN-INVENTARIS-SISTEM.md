# Laporan Inventaris Sistem — INKAI Surabaya

**Aplikasi:** Portal web Institut Karate-Do Indonesia (INKAI) Cabang Surabaya  
**Repository:** `inkai-sby`  
**Platform:** Next.js (App Router) + Inkai API + PostgreSQL (Supabase/Prisma)  
**Tanggal dokumen:** 17 Juli 2026  

---

## 1. Ringkasan eksekutif

Sistem **inkai-sby** adalah portal resmi Cabang Surabaya yang melayani:

1. **Publik** — informasi organisasi, kegiatan, dan pintu masuk pendaftaran.
2. **Anggota** — dashboard kartu anggota, iuran, absensi, kegiatan, prestasi, dokumen.
3. **Pengurus** — administrasi anggota, iuran, UKT, organisasi, verifikasi, dan pengaturan sesuai hierarki wilayah.

Data operasional utama diambil dari **Inkai API** (`inkai-ecosystem`). Database PostgreSQL/Prisma dipakai untuk pengaturan lokal, riwayat verifikasi, dan data pengurus.

---

## 2. Tujuan sistem

| Tujuan | Keterangan |
|--------|------------|
| Digitalisasi keanggotaan | Registrasi, verifikasi, NIA, dokumen, sabuk |
| Operasional ranting–cabang | Kelola anggota, iuran, absensi, event |
| Ujian Kenaikan Tingkat (UKT) | Periode, pendaftaran, Kyu Lama/Baru, invoice |
| Transparansi organisasi | Struktur wilayah, pengurus, konten publik |
| Kontrol akses wilayah | RBAC User → Ranting → Cabang → Pengprov → Pusat |

---

## 3. Arsitektur singkat

```
[Browser]
    │
    ▼
[Next.js — inkai-sby.vercel.app]
    ├── Auth (NextAuth + token Inkai)
    ├── UI Publik / Dashboard / Admin
    │
    ├──► Inkai API (anggota, billing, event, UKT, org)
    ├──► PostgreSQL / Prisma (pengaturan, verifikasi, audit lokal)
    ├──► Vercel Blob (upload dokumen/gambar, opsional)
    └──► Resend (email reset password, opsional)
```

**Environment utama:** `INKAI_API_URL`, `DATABASE_URL`, `AUTH_SECRET` / `NEXTAUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`.

---

## 4. Fitur website publik

| Route | Fungsi |
|-------|--------|
| `/` | Beranda, carousel berita, CTA login/daftar |
| `/sejarah` | Sejarah organisasi |
| `/makna-lambang` | Filosofi lambang |
| `/visi-misi` | Visi & misi |
| `/struktur` | Struktur cabang–ranting & pengurus |
| `/struktur/print` | Versi cetak struktur |
| `/kegiatan` | Daftar kegiatan |
| `/kegiatan/[id]` | Detail kegiatan |
| `/berita` | Berita dari carousel |
| `/dojo/[id]` | Profil ranting/dojo |
| `/v/[id]` | Verifikasi kartu anggota (scan QR — UUID atau NIA) |
| `/kontak` | Kontak sekretariat |
| `/keamanan-siber` | Kebijakan keamanan siber |
| `/login` | Login & registrasi |
| `/daftar` | Redirect ke form daftar |
| `/lupa-password` | Ajuan reset password |
| `/reset-password` | Set password baru |

---

## 5. Portal anggota (`/dashboard`)

| Modul | Status | Fungsi |
|-------|--------|--------|
| Beranda | Aktif | Kartu anggota (QR → `/v/[id]`), KPI absensi, tagihan, kegiatan, notifikasi |
| Profil | Aktif | Edit data pribadi (bukan Kyu/DAN) |
| Absensi | Aktif | Riwayat + check-in GPS (kode QR opsional) |
| Iuran | Aktif | Daftar tagihan + unggah bukti pembayaran |
| Kegiatan | Aktif | Pendaftaran event (dengan gate kelengkapan) |
| Materi Digital | Aktif | Katalog materi dari cabang (unduh/buka file) |
| Store | Aktif | Katalog produk + pesan (stok) |
| Prestasi & Sabuk | Aktif | Sabuk, unggah piagam, pelatihan |
| Dokumen | Aktif | Akte kelahiran & BPJS |
| Notifikasi | Aktif | Notifikasi anggota |
| Pesan | Aktif | Chat dengan pengurus |
| Pindah Dojo | Aktif | Ajuan pindah ranting → verifikasi |
| Panduan | Aktif | Panduan penggunaan |
| Riwayat | Aktif | Kegiatan yang sudah lewat |

---

## 6. Portal admin (`/admin`)

| Modul | Fungsi |
|-------|--------|
| Beranda Admin | KPI anggota, iuran pending, event, verifikasi |
| Kelola Anggota | Cari/filter, detail (kyu, iuran, akun), NIA, dokumen |
| Iuran Anggota | Verifikasi bukti + **edit tagihan** (nominal/jatuh tempo) + tandai lunas (ranting/cabang) |
| UKT | Periode, daftar peserta, multi-select ranting, bayar/verifikasi, sabuk target, nota (tanpa kode unik) |
| Organisasi | Wilayah & susunan pengurus |
| Verifikasi | Antrian klaim (anggota, dokumen, reset password, dll.) |
| Event & Kegiatan | Daftar + **buat event** (Cabang), link UKT / detail publik |
| Materi Digital | CRUD materi untuk anggota |
| Store | CRUD produk + kelola status pesanan |
| Pesan | Balas chat anggota |
| Absensi | Laporan absensi harian |
| Carousel Beranda | Kelola berita visual publik |
| Log Audit | Jejak aksi sensitif (pusat) |
| Pengaturan | User, cabang, ranting, peran/RBAC, geofencing, akun |

**Batasan admin ranting:** tanpa Organisasi, Carousel, Audit, serta sebagian submenu pengaturan tingkat cabang/pusat.

---

## 7. Hierarki wilayah & peran

### 7.1 Struktur organisasi

```
Pusat / Nasional
  └── Provinsi (Pengprov)
        └── Cabang
              └── Ranting / Dojo
                    └── Anggota
```

### 7.2 Kode peran

| Role | Label | Cakupan |
|------|-------|---------|
| `ADMINISTRATOR` / `ADMIN_PUSAT` / `ADMIN` | Pusat | Nasional |
| `ADMIN_PROVINCE` | Pengprov | `managedProvinceId` |
| `ADMIN_BRANCH` | Cabang | `managedBranchId` |
| `ADMIN_DOJO` | Ranting | `managedDojoId` |
| `MEMBER` | Anggota | `memberId` |
| `PARENT` | Orang tua | Anak anggota |

### 7.3 Matriks hak akses WILAYAH

| Area | User / Anggota | Ranting | Cabang | Pengprov |
|------|----------------|---------|--------|----------|
| Profil & akun | Edit profil sendiri | Tidak edit akun anggota | Lihat ranting & anggota di bawahnya | Lihat cabang, ranting & anggota di bawahnya |
| Kyu / DAN | Tidak edit sendiri | Tidak edit | **Edit Kyu (UKT & anggota)** | Tidak edit (hanya lihat) |
| Event (UKT, Gashuku, pertandingan) | Lihat & daftar sendiri | Daftarkan anggota ranting | **Buat event** + lihat pendaftar | Lihat event & pendaftar |
| NIA | Lihat sendiri | Tidak assign | **Assign NIA** | Lihat saja |
| Iuran | Lihat & bayar sendiri | **Edit tagihan + verifikasi bukti + tandai lunas** (scope dojo) | **Kelola iuran** cabang (edit/verifikasi/lunas) | Lihat saja (tanpa edit) |

---

## 8. Entitas data utama

| Entitas | Isi penting |
|---------|-------------|
| `Province` / `Branch` / `Dojo` | Wilayah & ranting (termasuk geofence) |
| `User` / `Role` / `Permission` | Akun & RBAC |
| `Member` | NIA, NIK, nama, sabuk, status, dokumen, dojo |
| `MemberRank` | Riwayat kenaikan sabuk |
| `Billing` / `Payment` | Tagihan & bukti bayar |
| `Event` / `EventCategory` / `EventRegistration` | Kegiatan & UKT |
| `Attendance` | Absensi (QR, lokasi) |
| `Verification` | Klaim verifikasi admin |
| `Notification` | Notifikasi |
| `NewsCarousel` | Konten beranda |
| `Product` / `StoreOrder` / `StoreOrderItem` | Katalog store & pesanan anggota |
| `DigitalMaterial` | Materi digital |
| `Conversation` / `Message` | Pesan anggota–pengurus |
| `AppSetting` | Setting aplikasi (mis. komisi ranting) |
| `AuditLog` | Log audit |

**Catatan:** UKT tidak punya tabel terpisah; diwujudkan sebagai `Event` bertema UKT + pendaftaran + tagihan terkait.

---

## 9. Alur bisnis yang sudah berjalan

### 9.1 Keanggotaan
1. Calon anggota daftar via `/login?tab=daftar`.
2. Status menunggu verifikasi.
3. Admin memverifikasi di `/admin/verifikasi` atau kelola anggota.
4. Cabang dapat mengisi **NIA**.
5. Anggota melengkapi profil & dokumen.

### 9.2 Iuran
1. Tagihan iuran bulanan muncul di sistem.
2. Anggota melihat tagihan di `/dashboard/iuran` dan dapat **mengunggah bukti** pembayaran.
3. **Ketua ranting / cabang** di `/admin/iuran` dapat:
   - mengedit nominal, jatuh tempo, deskripsi (tagihan belum lunas);
   - menandai lunas (tunai/setoran ranting) tanpa menunggu unggah bukti;
   - menyetujui / menolak bukti transfer (+ catatan).
4. Status: `PENDING` → `WAITING_VERIFICATION` → `PAID` / ditolak.

### 9.3 UKT (Ujian Kenaikan Tingkat)
1. **Cabang** membuat periode UKT per semester.
2. **Ranting** mendaftarkan anggota (snapshot **Sabuk saat ini / Kyu Lama** dikunci).
3. **Ranting** memilih peserta (multi-select) → **Nota Terpilih** / **Siap Bayar UKT** selaras baris terpilih.
4. **Cabang** **memverifikasi pembayaran** (per baris / bulk) dan mengisi **Sabuk target / Kyu Baru**.
5. Status **Selesai** bila sudah lunas + sabuk target terisi; sabuk resmi anggota diperbarui + riwayat.
6. Cetak nota memakai tabel biaya sabuk bulat; **tanpa kode unik** (+1…999). Tampilan tagihan UKT juga menampilkan nominal dasar (selaras nota).
7. Gate: tanggungan iuran dapat menghambat pendaftaran.

### 9.4 Kegiatan & absensi
- **Cabang** dapat membuat event non-UKT di `/admin/kegiatan` (Gashuku, pertandingan, dll.).
- Anggota mendaftar event jika profil/dokumen/iuran memenuhi syarat.
- Anggota check-in absensi via GPS di `/dashboard/absensi` (kode QR opsional); geofence ranting.
- Admin melihat laporan harian; mengatur koordinat & radius di Geofencing.

### 9.5 Materi, store, pesan, pindah dojo, piagam
- **Materi Digital** — admin unggah/kelola; anggota membuka file.
- **Store** — admin kelola produk/stok; anggota pesan; admin konfirmasi status.
- **Pesan** — anggota chat pengurus; admin balas di `/admin/pesan`.
- **Pindah Dojo** — anggota ajukan → antrian verifikasi `DOJO_TRANSFER` → setuju memperbarui dojo.
- **Piagam** — anggota unggah di Prestasi → verifikasi `ACHIEVEMENT`.

### 9.6 Konten & organisasi
- Carousel beranda dikelola admin.
- Struktur & pengurus dikelola di modul Organisasi (terbatas role).

### 9.7 Verifikasi kartu anggota (publik)
1. QR pada kartu anggota dashboard mengarah ke `/v/[id]` (`id` = UUID anggota atau NIA).
2. Halaman publik menampilkan nama, NIA, sabuk, status, dojo, cabang (data dari Inkai API).
3. Scope dibatasi anggota Cabang Surabaya; halaman tidak di-index mesin pencari.

---

## 10. Integrasi teknis

| Integrasi | Fungsi |
|-----------|--------|
| Inkai API | Auth, anggota, billing, event, UKT, organisasi |
| NextAuth | Sesi login JWT + kredensial |
| PostgreSQL / Prisma | Data lokal & sinkron schema dengan backend |
| Vercel Blob | Upload file (dokumen/gambar) |
| Resend | Email reset password |
| Rate limit & validasi | Proteksi endpoint sensitif |

---

## 11. Status kelengkapan & celah

| Area | Status | Catatan untuk laporan / rencana |
|------|--------|----------------------------------|
| Portal publik | Lengkap | Konten organisasi & kegiatan |
| Dashboard anggota inti | Lengkap | Profil, iuran, absensi, kegiatan, sabuk, materi, store, pesan, pindah |
| Admin anggota / iuran / UKT | Lengkap | Iuran: edit/lunas/verifikasi (ranting+cabang); UKT multi-select, nota tanpa kode unik |
| Verifikasi kartu (publik) | Aktif | `/v/[id]` — scan QR kartu anggota |
| Event non-UKT | Aktif | Buat event di `/admin/kegiatan` (Cabang) |
| Materi / Store / Pesan / Pindah / Piagam | Aktif | Prisma lokal + verifikasi admin |
| RBAC wilayah | Diterapkan | Matriks tampil di Pengaturan & Role |
| Upload bukti iuran (anggota) | Aktif | `/dashboard/iuran` + `/api/member/billing/[id]` |
| Scan/check-in absensi (anggota) | Aktif | `/dashboard/absensi` + `/api/member/attendance/checkin` |
| Nominal UKT | Tanpa kode unik | `uktBaseFeeAmount` — tampilan/KPI strip +1…999 agar = nota |
| Ketergantungan API | Ada | Halaman degrade jika API sibuk/timeout |
| Email & Blob | Opsional | Perlu env production |

---

## 12. Indikator yang bisa dilaporkan (contoh KPI)

Dari data yang sudah ada di sistem, laporan berkala dapat mencakup:

1. **Jumlah anggota** aktif / pending / tanpa NIA / dokumen kurang  
2. **Sebaran per ranting**  
3. **Iuran** — lunas, pending, menunggu verifikasi, nilai rupiah  
4. **UKT** — peserta per periode, Kyu Lama → Kyu Baru, status pembayaran  
5. **Absensi** — kehadiran harian / semester (untuk eligibility)  
6. **Verifikasi** — antrian & yang selesai  
7. **Event** — jumlah kegiatan & pendaftar  
8. **Audit** — ringkasan aksi admin sensitif  

---

## 13. Peta route API utama (lampiran teknis)

```
/api/auth/*                 Login, register, forgot/reset password
/api/admin/members/*        Kelola anggota
/api/admin/billing/[id]     Edit tagihan, verifikasi, tandai lunas (ranting/cabang)
/api/admin/ukt/*            Periode, register, invoice, fees, Kyu
/api/admin/pengaturan/*     User, cabang, ranting, roles, geofencing, akun
/api/admin/verifications/*  Proses klaim
/api/admin/carousel/*       Carousel beranda
/api/admin/upload           Upload ke Blob
/api/member/*               Profil, daftar event, upload bukti iuran, check-in absensi
/api/admin/events           Buat event non-UKT (Cabang)
/api/admin/materi/*         CRUD materi digital
/api/admin/store/*          Produk & status pesanan
/api/admin/pesan/*          Inbox & balas pesan
/api/member/materi          Daftar materi
/api/member/store           Katalog & pesan produk
/api/member/pesan           Chat pengurus
/api/member/pindah          Ajuan pindah dojo
/api/member/piagam          Unggah piagam
/api/member/billing/[id]    Unggah bukti pembayaran iuran
/api/member/attendance/checkin  Check-in absensi GPS
/api/notifications/*        Notifikasi
/api/dojos                  Daftar dojo publik
Inkai API `/v1/members/verify/[id]`  Verifikasi kartu anggota (publik, via halaman `/v/[id]`)
```

---

## 14. Kesimpulan

Sistem INKAI Surabaya sudah mencakup **siklus inti organisasi karate**: keanggotaan, dokumen, iuran, UKT/kenaikan sabuk, absensi, kegiatan, dan administrasi berjenjang sesuai wilayah.

Yang paling matang untuk operasional cabang saat ini:

- Kelola anggota & NIA  
- Iuran: upload bukti anggota + **edit/lunas/verifikasi** oleh ketua ranting & cabang  
- UKT end-to-end (daftar → bayar → verifikasi → sabuk target → nota tanpa kode unik)  
- Verifikasi kartu anggota publik (`/v/[id]`)  
- Event non-UKT (buat di admin)  
- Absensi anggota (GPS) + laporan admin  
- Materi, store, pesan, pindah dojo, unggah piagam  
- Hak akses wilayah (User / Ranting / Cabang / Pengprov)  

Prioritas pengembangan lanjutan yang disarankan:

1. (Opsional) Sinkron backend agar billing UKT tidak lagi menulis `uniqueTail` di DB  
2. Perkaya store (multi-item cart, pembayaran terintegrasi)  
3. Notifikasi push / email untuk pesan & verifikasi  

---

## 15. Riwayat penyusunan dokumen

| Tanggal | Keterangan |
|---------|------------|
| 17 Juli 2026 | Inventaris awal berdasarkan codebase `inkai-sby` (fitur, RBAC wilayah, UKT, celah) |
| 17 Juli 2026 | Update: upload bukti iuran & check-in absensi anggota; alur UKT multi-select + verifikasi Cabang + status Selesai; nominal UKT tanpa kode unik (selaras nota); rule Cursor wajib update dokumen ini |
| 17 Juli 2026 | Selesaikan stub: Materi, Store, Pesan, Pindah Dojo, unggah Piagam; buat event non-UKT di admin; API & nav terkait |
| 17 Juli 2026 | Iuran: ketua ranting/cabang dapat edit tagihan, tandai lunas, verifikasi bukti (+ catatan); scope ranting ke dojo |
| 17 Juli 2026 | Halaman publik `/v/[id]` — verifikasi kartu anggota via scan QR (Inkai API `/v1/members/verify/[id]`, scope cabang Surabaya) |

---

*Dokumen ini disusun untuk keperluan laporan organisasi dan dapat dilampirkan pada presentasi pengurus Cabang / Pengprov.*
