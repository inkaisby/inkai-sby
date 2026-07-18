# Laporan Inventaris Sistem — INKAI Surabaya

**Aplikasi:** Portal web Institut Karate-Do Indonesia (INKAI) Cabang Surabaya  
**Repository:** `inkai-sby`  
**Platform:** Next.js (App Router) + Inkai API + PostgreSQL (Supabase/Prisma)  
**Tanggal dokumen:** 17 Juli 2026  
**Peran:** living context untuk pengurus & agent — baca sebelum develop; update bersamaan dengan perubahan kode. Nama file ini **tetap**.

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
| Ujian Kenaikan Tingkat (UKT) | Periode, pendaftaran, Kyu Lama/Baru, nota |
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
| `/dojo` | Daftar dojo/ranting Cabang Surabaya (detail lengkap, tanpa jumlah anggota) |
| `/dojo/[id]` | Profil ranting/dojo |
| `/v/[id]` | Verifikasi kartu anggota (scan QR — UUID atau NIA) |
| `/kontak` | Kontak sekretariat |
| `/keamanan-siber` | Kebijakan keamanan siber |
| `/login` | Login & registrasi (form selaras admin: identitas, sabuk, akun, dojo) |
| `/daftar` | Redirect ke form daftar |
| `/lupa-password` | Ajuan reset password |
| `/reset-password` | Set password baru |

---

## 5. Portal anggota (`/dashboard`)

| Modul | Status | Fungsi |
|-------|--------|--------|
| Beranda | Aktif | Kartu anggota (QR → `/v/[id]`, sabuk live refresh), KPI absensi, tagihan, kegiatan, notifikasi |
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
| Kelola Anggota | Cari/filter, detail (kyu, iuran, akun), NIA, dokumen; nonaktif/tangguhkan (alasan), aktifkan, bulk; hapus arsip + pulihkan; filter nonaktif ≥N bulan |
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
| Pengaturan | User (CRUD/role/cakupan/reset), cabang/ranting (+arsip pulihkan), **profil & kebijakan**, peran/RBAC, geofencing (lokasi perangkat), akun |

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
| Status keanggotaan | Lihat sendiri | **Nonaktifkan / aktifkan**; hapus koreksi (tanpa NIA resmi) | **Nonaktif / aktif / hapus (arsip)** anggota cabang | Lihat saja |

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
1. Calon anggota daftar via `/login?tab=daftar` — form **Identitas** (nama, JK, tempat/tgl lahir, alamat, NIK, **NIA opsional**, telepon), **Sabuk** (Kyu saat ini), **Akun** (email/password), **Dojo**; selaras dengan **Tambah Anggota Baru** di `/admin/anggota` dan `/admin/ukt`.
2. `POST /api/auth/register` dan `POST /api/admin/members` meneruskan semua field anggota (termasuk NIA jika diisi) ke Inkai API.
3. Status menunggu verifikasi (publik) atau aktif langsung (admin/ranting).
4. Admin memverifikasi di `/admin/verifikasi` atau kelola anggota.
5. Cabang dapat mengisi **NIA** bila belum diisi saat pendaftaran.
6. Anggota melengkapi profil & dokumen.
7. **Nonaktifkan** (status `INACTIVE` / `SUSPENDED`) — ranting/cabang; wajib alasan + catatan; notifikasi ke anggota; login diblokir; NIA & riwayat tetap; dapat **aktifkan kembali**. Bulk nonaktif tersedia.
8. **Hapus** = soft-delete (`isDeleted`) — cek dampak iuran/UKT; anggota aktif/ber-NIA hanya cabang (+ ketik nama). Arsip dapat dilihat & **dipulihkan** (jadi Nonaktif) oleh cabang.

### 9.2 Iuran
1. Tagihan iuran bulanan muncul di sistem.
2. Anggota melihat tagihan di `/dashboard/iuran` dan dapat **mengunggah bukti** pembayaran.
3. **Ketua ranting / cabang** di `/admin/iuran` dapat:
   - mengedit nominal, jatuh tempo, deskripsi (tagihan belum lunas);
   - menandai lunas (tunai/setoran ranting) tanpa menunggu unggah bukti;
   - menyetujui / menolak bukti transfer (+ catatan).
4. Status: `PENDING` → `WAITING_VERIFICATION` → `PAID` / ditolak.

### 9.3 UKT (Ujian Kenaikan Tingkat)
1. **Cabang** membuat periode UKT per semester (Semester I = Jan–Jun, Semester II = Jul–Des); setiap semester = **event terpisah** dengan registrasi & pembayaran sendiri.
2. URL admin `/admin/ukt?semester=I|II&year=YYYY&period=<eventId>` — dropdown semester/tahun **otomatis** memilih event yang cocok; bila periode belum ada, tampil tombol **Buat Periode**.
3. **Ranting** mendaftarkan anggota (snapshot **Sabuk saat ini / Kyu Lama** dikunci per periode).
4. Pendaftaran UKT kini memakai **gate operasional**: periode masih terbuka, **iuran tidak menunggak**, **dokumen Akte + BPJS lengkap**, dan **kehadiran semester minimal 75%**.
5. **Ranting** memilih peserta (multi-select) → **Nota Terpilih** / **Siap Bayar UKT** selaras baris terpilih.
6. **Cabang** **memverifikasi pembayaran** (per baris / bulk), lalu mencatat **hasil ujian**: `LULUS` / `GAGAL` / `MENGULANG`.
7. **Sabuk target / Kyu Baru** hanya dapat diisi setelah peserta **lunas** dan hasil ujian ditandai **LULUS**.
8. Status operasional UKT disederhanakan untuk UI: **Belum Daftar / Belum Bayar / Menunggu Verifikasi / Menunggu Ujian / Lulus Ujian / Tidak Lulus / Mengulang / Selesai**.
9. Status **Selesai** bila sudah lunas + lulus + sabuk target terisi; sabuk resmi anggota diperbarui + riwayat.
10. Cetak nota memakai tabel biaya sabuk bulat; **tanpa kode unik** (+1…999). Nomor nota memuat semester (`UKT/SBY/{RANTING}/I|II/{tahun}`).
11. Batas pendaftaran default = akhir semester; cabang dapat **perpanjang** manual.
12. Dashboard anggota menampilkan **kartu Status UKT** di beranda & Prestasi; admin cabang dapat **export CSV**, **waiver** syarat, wizard buat periode, dan action bar terpadu (nota + verifikasi).

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
| Admin anggota / iuran / UKT | Lengkap | Iuran: edit/lunas/verifikasi (ranting+cabang); anggota: nonaktif/aktif/hapus arsip; UKT pakai gate iuran+dokumen+absensi, hasil ujian, rekap ranting, nota tanpa kode unik |
| Verifikasi kartu (publik) | Aktif | `/v/[id]` — scan QR kartu anggota |
| Event non-UKT | Aktif | Buat event di `/admin/kegiatan` (Cabang) |
| Materi / Store / Pesan / Pindah / Piagam | Aktif | Prisma lokal + verifikasi admin |
| RBAC wilayah | Diterapkan | Matriks tampil di Pengaturan & Role |
| Upload bukti iuran (anggota) | Aktif | `/dashboard/iuran` + `/api/member/billing/[id]` |
| Scan/check-in absensi (anggota) | Aktif | `/dashboard/absensi` + `/api/member/attendance/checkin` |
| Nominal UKT | Tanpa kode unik | `uktBaseFeeAmount` — tampilan/KPI strip +1…999 agar = nota |
| Eligibility UKT | Diterapkan | Gate periode tutup, iuran, dokumen, absensi semester minimum 75% |
| Hasil ujian UKT | Aktif | Cabang tetapkan `LULUS` / `GAGAL` / `MENGULANG`; Kyu Baru **wajib** setelah LULUS |
| Status UKT anggota | Aktif | `/api/member/ukt-status` + kartu status di beranda & Prestasi (CTA langkah berikutnya) |
| Filter/KPI UKT operasional | Aktif | Status UI selaras: Belum Bayar, Menunggu Verif/Ujian, Lulus, Selesai |
| Pengecualian UKT (waiver) | Aktif | Cabang kecualikan iuran/dokumen/absensi + catatan audit |
| Export rekap UKT | Aktif | CSV per periode/ranting dari admin UKT |
| Notifikasi UKT | Aktif | Otomatis ke anggota saat daftar, verifikasi bayar, hasil ujian, selesai |
| Ketergantungan API | Ada | Halaman degrade jika API sibuk/timeout |
| Email & Blob | Opsional | Perlu env production |

---

## 12. Indikator yang bisa dilaporkan (contoh KPI)

Dari data yang sudah ada di sistem, laporan berkala dapat mencakup:

1. **Jumlah anggota** aktif / pending / tanpa NIA / dokumen kurang  
2. **Sebaran per ranting**  
3. **Iuran** — lunas, pending, menunggu verifikasi, nilai rupiah  
4. **UKT** — peserta per periode, Kyu Lama → Kyu Baru, status pembayaran, hasil ujian, kelulusan per ranting  
5. **Absensi** — kehadiran harian / semester (untuk eligibility)  
6. **Verifikasi** — antrian & yang selesai  
7. **Event** — jumlah kegiatan & pendaftar  
8. **Audit** — ringkasan aksi admin sensitif  

---

## 13. Peta route API utama (lampiran teknis)

```
/api/auth/*                 Login, register (+ identitas/sabuk lengkap), forgot/reset password
/api/admin/members/*        Kelola anggota (approve/NIA/nonaktif/aktif/hapus/restore)
/api/admin/members/bulk     Bulk nonaktifkan
/api/admin/members/archived Daftar arsip soft-delete
/api/admin/billing/[id]     Edit tagihan, verifikasi, tandai lunas (ranting/cabang)
/api/admin/ukt/*            Periode, register, waiver, nota, hasil ujian, fees, Kyu
/api/admin/pengaturan/*     User, cabang, ranting, roles, geofencing, akun, kebijakan
/api/admin/verifications/*  Proses klaim
/api/admin/carousel/*       Carousel beranda
/api/admin/upload           Upload ke Blob
/api/member/profile          GET sabuk kartu (no-store) + PATCH profil
/api/member/ukt-status       Kartu status UKT periode aktif untuk anggota
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

- Kelola anggota & NIA (nonaktifkan / aktifkan / hapus arsip)  
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
| 17 Juli 2026 | Kartu anggota dashboard: sabuk dari `resolveMemberDisplayRank` (currentRank + riwayat + UKT selesai) + refresh otomatis via `GET /api/member/profile` tanpa cache |
| 17 Juli 2026 | Registrasi publik selaras admin: `MemberFormSections` (Identitas + Sabuk), field birthPlace/address/currentRank, `registerSchema` & `POST /api/auth/register` teruskan semua field ke Inkai API; perbaikan fetch `/api/dojos` (`data.data`) |
| 17 Juli 2026 | Nav topbar **Dojo / Ranting** → `/dojo`: daftar lengkap dojo Cabang Surabaya (alamat, kontak, jadwal, tempat latihan; tanpa jumlah anggota) |
| 17 Juli 2026 | Field **NIA opsional** di form Tambah Anggota Baru (admin/anggota, admin/ukt, login?tab=daftar) — `MemberIdentitySection`, `uktMemberCreateSchema`, `registerSchema`, create & register API |
| 17 Juli 2026 | UKT admin: sinkron otomatis semester/tahun ↔ event periode (`findUktPeriodForTerm`, redirect URL kanonik, ganti semester langsung pilih event yang cocok) |
| 17 Juli 2026 | UKT ranting: navigasi semester/tahun sama cabang, link menu ke URL kanonik, banner jika periode belum dibuat, pertahankan query saat ganti akun |
| 17 Juli 2026 | UKT lengkap: gate pendaftaran (periode, iuran, dokumen, absensi), hasil ujian `LULUS/GAGAL/MENGULANG`, Kyu Baru hanya setelah lulus+lunas, rekap ranting untuk WA, dan kartu status UKT anggota |
| 17 Juli 2026 | UKT: hapus alur invoice (buat/konfirmasi); pembayaran ranting–cabang cukup lewat **nota** (Cetak Nota / Nota Terpilih / Siap Bayar UKT) |
| 17 Juli 2026 | UKT operasional lengkap: filter/KPI status operasional, kolom kehadiran+syarat, action bar terpadu, hard block Kyu Baru, waiver cabang, export CSV, wizard periode, notifikasi anggota, kartu UKT di beranda |
| 18 Juli 2026 | Nama file dikunci sebagai living context agentic; rule Cursor + `AGENTS.md` wajib baca inventaris sebelum develop, update di turn yang sama |
| 18 Juli 2026 | Admin anggota: nonaktifkan/aktifkan ulang + hapus soft-delete (konfirmasi nama untuk ber-NIA); KPI/filter Nonaktif; RBAC ranting vs cabang; login blokir status INACTIVE |
| 18 Juli 2026 | Paket lengkap lifecycle anggota: alasan+jenis (INACTIVE/SUSPENDED), notifikasi, tombol Nonaktif terlihat, bulk nonaktif, arsip+pulihkan, dampak hapus, filter ≥N bulan, metadata di detail, QR nonaktif jelas |
| 18 Juli 2026 | Paket lengkap Pengaturan: hub kartu+checklist, profil/kebijakan cabang, user create/edit/reset/export, geofence lokasi perangkat, arsip pulihkan cabang/ranting, kredensial tanpa localStorage |

---

*Dokumen ini living inventaris organisasi (bukan laporan sekali-jadi) dan dapat dilampirkan pada presentasi pengurus Cabang / Pengprov.*
