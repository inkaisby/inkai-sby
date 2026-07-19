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
| Beranda | Aktif | Kartu anggota, **checklist keanggotaan + CTA**, dojo/jadwal/**absen hari ini**/PIC, aksi cepat kontekstual, UKT, agenda gabungan, badge pesan+notif |
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
| Beranda Admin | KPI anggota, iuran pending, event, verifikasi, **pesan unread**; aksi cepat role-aware + notifikasi; **ikon back** di topbar (kecuali beranda) |
| Kelola Anggota | Cari **autocomplete** (tanpa tombol Filter); detail, NIA, dokumen; kolom **Terdaftar**; **edit Iuran/bln** (ranting/cabang); nonaktif/bulk; **export CSV**; **bulk approve pending**; **hapus/arsip** (ranting+cabang; aktif/ber-NIA: ketik nama; **bulk: ketik ARSIPKAN**); arsip: **pilih semua + hapus permanen** (ketik HAPUS) / pulihkan cabang |
| Iuran Anggota | Verifikasi + edit + lunas; **buat tagihan bulan**; filter bulan; label ID; **export CSV** |
| UKT | Periode, daftar peserta, multi-select ranting, bayar/verifikasi, sabuk target, nota, **export**, **hari-H**, **setoran**, **arsip** |
| Organisasi | Wilayah & pengurus; **deep-link** ke Pengaturan cabang/ranting |
| Verifikasi | Antrian klaim + **filter tipe/aging**; riwayat |
| Event & Kegiatan | Buat + **ubah/tutup** event non-UKT + **roster pendaftar**; link UKT |
| Materi Digital | CRUD + **upload Blob** + **publish/draft** |
| Store | CRUD produk (**edit/stok/aktif**) + status pesanan berlabel ID |
| Pesan | Inbox + unread badge, cari, balas, **broadcast notifikasi** |
| Absensi | Harian + **belum hadir** + **rekap semester %** + export |
| Carousel Beranda | Upload gambar + aktif + **urutkan** |
| Log Audit | Filter aksi/cari + **export CSV** (pusat) |
| Notifikasi | Inbox admin (ada di nav); **ranting hanya lihat notif rantingnya**; cabang lihat semua + badge ranting |
| Pengaturan | User digabung ke **Ranting & User**; cabang edit data ranting + **email/password** PIC di form Ubah Data; admin ranting: form **Ubah Data** lengkap (multi-ranting) + **email/password** di **Akun Saya**; multi-akun (Akun), kebijakan, peran (**preset**), geofencing (**pratinjau peta**), akun |

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
| `ADMIN_DOJO` | Ranting | `managedDojoId` (utama) + `managedDojoIds` (multi, AppSetting) |
| `MEMBER` | Anggota | `memberId` |
| `PARENT` | Orang tua | Anak anggota |

### 7.3 Matriks hak akses WILAYAH

| Area | User / Anggota | Ranting | Cabang | Pengprov |
|------|----------------|---------|--------|----------|
| Profil & akun | Edit profil sendiri | Tidak edit akun anggota | Lihat ranting & anggota di bawahnya | Lihat cabang, ranting & anggota di bawahnya |
| Kyu / DAN | Tidak edit sendiri | Tidak edit | **Edit Kyu (UKT & anggota)** | Tidak edit (hanya lihat) |
| Event (UKT, Gashuku, pertandingan) | Lihat & daftar sendiri | Daftarkan anggota ranting | **Buat event** + lihat pendaftar | Lihat event & pendaftar |
| NIA | Lihat sendiri | Tidak assign | **Assign NIA** | Lihat saja |
| Iuran | Lihat & bayar sendiri | **Edit tagihan + verifikasi + lunas**; **edit Iuran/bln per anggota** (scope dojo) | **Kelola iuran** cabang (edit/verifikasi/lunas + Iuran/bln) | Lihat saja (tanpa edit) |
| Status keanggotaan | Lihat sendiri | **Nonaktifkan / aktifkan**; **hapus/arsip** (aktif/ber-NIA: ketik nama; bulk: ketik ARSIPKAN); **gabungkan duplikat** | **Nonaktif / aktif / hapus (arsip)** + bulk; gabungkan duplikat | Lihat saja |

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
1. Calon anggota daftar via `/login?tab=daftar` — form **Identitas lengkap wajib** (nama, JK, tempat/tgl lahir, alamat, **NIK 16 digit**, telepon; **NIA tetap opsional**), **Sabuk**, **Akun**, **Dojo**. **Tambah Anggota** oleh ranting/cabang: NIK/NIA boleh kosong. Field teks identitas **huruf besar**; **tanggal lahir** bisa paste (mis. `28 Februari 2011`).
2. `POST /api/auth/register` dan `POST /api/admin/members` meneruskan semua field anggota (termasuk NIA jika diisi) ke Inkai API.
3. Status menunggu verifikasi (publik) atau aktif langsung (admin/ranting).
4. **Deteksi duplikat** sebelum simpan: **keras** jika NIK, NIA, atau nama tepat + tanggal lahir sama (cakupan Cabang Surabaya); **lunak** jika nama mirip. Blok `POST /api/admin/members` & `POST /api/auth/register` (409); UI peringatan di form tambah anggota & daftar publik.
5. **Gabungkan (merge)** oleh ranting/cabang di detail `/admin/anggota`: data operasional dipertahankan, akun login dari daftar mandiri dipindahkan, duplikat diarsipkan (`POST /api/admin/members/merge`). Cocok untuk kasus ranting daftar dulu (tanpa akun) lalu anggota daftar mandiri (PENDING + akun), atau sebaliknya.
6. Admin memverifikasi di `/admin/verifikasi` atau kelola anggota.
7. Cabang dapat mengisi **NIA** bila belum diisi saat pendaftaran, dan **mengedit sabuk** anggota (kolom Sabuk di `/admin/anggota`).
8. Anggota melengkapi profil & dokumen.
9. **Nonaktifkan** (status `INACTIVE` / `SUSPENDED`) — ranting/cabang; wajib alasan + catatan; notifikasi ke anggota; login diblokir; NIA & riwayat tetap; dapat **aktifkan kembali**. Bulk nonaktif tersedia.
10. **Hapus** = soft-delete (`isDeleted`) — cek dampak iuran/UKT; ranting & cabang dalam scope; aktif/ber-NIA wajib ketik nama. **Bulk hapus/arsip** dari floating bar (konfirmasi ketik `ARSIPKAN`). Arsip dapat dilihat & **dipulihkan** (jadi Nonaktif) oleh cabang; **bulk hapus permanen** di arsip (ketik `HAPUS`).

### 9.2 Iuran
1. Tagihan iuran bulanan muncul di sistem.
2. Anggota melihat tagihan di `/dashboard/iuran` dan dapat **mengunggah bukti** pembayaran.
3. **Ketua ranting / cabang** di `/admin/iuran` dapat:
   - mengedit nominal, jatuh tempo, deskripsi (tagihan belum lunas);
   - menandai lunas (tunai/setoran ranting) tanpa menunggu unggah bukti;
   - menyetujui / menolak bukti transfer (+ catatan).
4. **Iuran/bln per anggota** dapat diubah ranting/cabang di detail `/admin/anggota` (`PATCH set_dues`); generate tagihan bulanan memakai nominal per anggota bila ada, else default kebijakan.
5. Status: `PENDING` → `WAITING_VERIFICATION` → `PAID` / ditolak.

### 9.3 UKT (Ujian Kenaikan Tingkat)
1. **Cabang** membuat periode UKT per semester (Semester I = Jan–Jun, Semester II = Jul–Des); setiap semester = **event terpisah** dengan registrasi & pembayaran sendiri.
2. URL admin `/admin/ukt?semester=I|II&year=YYYY&period=<eventId>` — dropdown semester/tahun **otomatis** memilih event yang cocok; bila **belum ada periode berjudul semester/tahun**, tombol **Buat Periode** di toolbar (kiri Dokumen/Export).
3. **Ranting** mendaftarkan anggota (snapshot **Sabuk saat ini / Kyu Lama** dikunci per periode).
4. Pendaftaran UKT kini memakai **gate operasional**: periode masih terbuka, **iuran tidak menunggak**, **dokumen Akte + BPJS lengkap**, dan **kehadiran semester minimal 75%**.
5. **Ranting** memilih peserta (multi-select) → **Nota Terpilih** / **Siap Bayar UKT** selaras baris terpilih.
6. **Cabang** **memverifikasi pembayaran** (per baris / bulk), lalu mencatat **hasil ujian**: `LULUS` / `GAGAL` / `MENGULANG`.
7. **Sabuk target / Kyu Baru** hanya dapat diisi setelah peserta **lunas** dan hasil ujian ditandai **LULUS**.
8. Status operasional UKT disederhanakan untuk UI: **Belum Daftar / Belum Bayar / Menunggu Verifikasi / Menunggu Ujian / Lulus Ujian / Tidak Lulus / Mengulang / Selesai**.
9. Status **Selesai** bila sudah lunas + lulus + sabuk target terisi; sabuk resmi anggota diperbarui + riwayat.
10. Cetak nota memakai tabel biaya sabuk bulat; **tanpa kode unik** (+1…999). Nomor nota memuat semester (`UKT/SBY/{RANTING}/I|II/{tahun}`). Pejabat (Bidang Ujian / Bendahara) dari **Pengaturan → Kebijakan**.
11. Batas pendaftaran default = akhir semester; cabang dapat **atur saat buat periode** (wizard) atau **perpanjang** manual setelahnya.
12. Dashboard anggota menampilkan **kartu Status UKT** di beranda & Prestasi; admin cabang: **export daftar peserta** (Print/Save as PDF/CSV + pilih ranting + validasi data), **Laporan WA** ringkas, **hari-H** (roster hadir + hasil massal), **status setoran** ranting↔cabang, **arsip/kunci periode**, waiver, wizard, action bar.
13. Toolbar cabang: **Buat Periode**, Hari-H, Export, Laporan WA, Cetak Nota, Biaya Sabuk, Arsip (tombol terpisah).

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
| Rate limit | Upstash Redis opsional (`UPSTASH_REDIS_*`); fallback memori per instance |
| Verifikasi klaim | Fail-closed ke Inkai API + `assertDojoInScope` + audit |

---

## 11. Status kelengkapan & celah

| Area | Status | Catatan untuk laporan / rencana |
|------|--------|----------------------------------|
| Portal publik | Lengkap | Konten organisasi & kegiatan |
| Dashboard anggota inti | Lengkap | Beranda asisten: checklist, jadwal dojo, absen hari ini, PIC, aksi kontekstual, agenda |
| Admin anggota / iuran / UKT | Lengkap | Iuran: edit/lunas/verifikasi (ranting+cabang); anggota: nonaktif/aktif/hapus arsip + **edit sabuk (cabang)**; UKT pakai gate iuran+dokumen+absensi, hasil ujian, rekap ranting, nota tanpa kode unik |
| Verifikasi kartu (publik) | Aktif | `/v/[id]` — scan QR kartu anggota |
| Event non-UKT | Aktif | Buat event di `/admin/kegiatan` (Cabang) |
| Materi / Store / Pesan / Pindah / Piagam | Aktif | Pesan: partisipan wajib (tanpa IDOR/fallback all); unread + cari + broadcast; store/materi upload |
| RBAC wilayah | Diterapkan | Matriks tampil di Pengaturan & Role; multi-akun per cabang/ranting + PIC; **preset permission** |
| Pengaturan wilayah | Lengkap | Multi-akun satu pintu, jabatan, PIC, serah terima; **email/password PIC** di form Ubah Data ranting (cabang); admin ranting ubah email/password di **Akun Saya** (email bisa diedit); geofence + **pratinjau peta OSM**; degradasi username login: klasifikasi pool vs error lain, KPI/filter aman saat DB gagal; **multi-ranting per akun** (`AppSetting` + context switcher) |
| Upload bukti iuran (anggota) | Aktif | `/dashboard/iuran` + `/api/member/billing/[id]` |
| Scan/check-in absensi (anggota) | Aktif | `/dashboard/absensi` + `/api/member/attendance/checkin` |
| Absensi admin | Aktif | Harian, belum hadir, rekap semester %, export CSV |
| Iuran generate bulan | Aktif | `POST /api/admin/billing/generate` + UI Iuran |
| Nav admin | Campuran | Top-level: Iuran, UKT, Event, Absensi; grup: Keanggotaan / Konten / Sistem + badge unread pesan |
| Deteksi duplikat anggota | Aktif | Keras: NIK / NIA / nama+TTL; lunak: nama; blok create admin & daftar publik; UI peringatan |
| Gabungkan duplikat | Aktif | Ranting/cabang: pindahkan akun login + riwayat ke data operasional; arsipkan duplikat |
| Audit admin | Aktif | Filter + export CSV di `/admin/audit` |
| Nominal UKT | Tanpa kode unik | Frontend tidak menulis `uniqueTail`; tampilan pakai `uktBaseFeeAmount` (+ strip data lama). Sinkron backend Inkai (opsional) |
| Unduh PDF UKT | Aktif | Tombol **Unduh PDF** di nota & export peserta (jspdf+html2canvas); Print tetap ada |
| Email notifikasi | Opsional (Resend) | `notifyUser` kirim email bila `RESEND_API_KEY`; dipakai pesan admin, verifikasi, UKT, lifecycle; reset-password email ke ranting |
| Eligibility UKT | Diterapkan | Gate periode tutup, iuran, dokumen, absensi semester minimum 75% |
| Hasil ujian UKT | Aktif | Cabang tetapkan `LULUS` / `GAGAL` / `MENGULANG`; Kyu Baru **wajib** setelah LULUS |
| Status UKT anggota | Aktif | `/api/member/ukt-status` + kartu status di beranda & Prestasi (CTA langkah berikutnya) |
| Filter/KPI UKT operasional | Aktif | Status UI selaras: Belum Bayar, Menunggu Verif/Ujian, Lulus, Selesai |
| Pengecualian UKT (waiver) | Aktif | Cabang kecualikan iuran/dokumen/absensi + catatan audit |
| Export rekap UKT | Aktif | Daftar peserta (formulir): Print/Save as PDF/CSV + pilih ranting + validasi + pratinjau |
| UKT hari-H | Aktif | Roster kehadiran di tempat + hasil massal LULUS/GAGAL/MENGULANG |
| Setoran UKT | Aktif | Ranting tandai setor → cabang konfirmasi diterima (`ukt-deposit`) |
| Arsip periode UKT | Aktif | Kunci periode (blok daftar/ubah); export tetap |
| Notifikasi UKT | Aktif | Otomatis ke anggota saat daftar, verifikasi bayar, hasil ujian, selesai |
| Ketergantungan API | Ada | Halaman degrade jika API sibuk/timeout |
| Email & Blob | Opsional | Perlu env production |
| Keamanan P0–P2 | Diperkuat | Pesan IDOR ditutup; verifikasi fail-closed; rate limit Upstash opsional; CSRF admin ketat; password register; audit upload/broadcast/verifikasi |
| Performa admin | Diperkuat | Badge pesan di-cache 45s; KPI anggota 1× groupBy; absensi/UKT scoped (bukan limit 3000); broadcast/generate chunked; polling diperlambat |
| Index Prisma | Ditambah | Member/Billing/Attendance/Verification/Message — jalankan migrate/db push di production |

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
/api/auth/*                 Login, register (+ identitas/sabuk lengkap), check-duplicate, forgot/reset password
/api/admin/members/*        Kelola anggota (approve/NIA/set_rank/set_dues/nonaktif/aktif/hapus/restore/check-duplicate/merge)
/api/admin/members/bulk     Bulk nonaktif / approve / hapus-arsip (ARSIPKAN) / purge arsip (HAPUS) / restore
/api/admin/members/archived Daftar arsip soft-delete
/api/admin/billing/[id]     Edit tagihan, verifikasi, tandai lunas (ranting/cabang)
/api/admin/billing/generate Buat tagihan iuran bulanan massal
/api/admin/ukt/*            Periode, register, waiver, nota, hasil ujian, fees, Kyu, exam-day, deposit, period-meta
/api/admin/pengaturan/*     User, cabang, ranting, wilayah-accounts, roles, geofencing, akun, kebijakan (pejabat dokumen)
/api/admin/verifications/*  Proses klaim
/api/admin/carousel/*       Carousel beranda
/api/admin/upload           Upload ke Blob
/api/admin/events           Buat event non-UKT (Cabang)
/api/admin/events/[id]      Detail/roster + ubah/tutup event
/api/member/profile          GET sabuk kartu (no-store) + PATCH profil
/api/member/ukt-status       Kartu status UKT periode aktif untuk anggota
/api/admin/materi/*         CRUD materi digital
/api/admin/store/*          Produk & status pesanan
/api/admin/pesan/*          Inbox, unread, tandai dibaca, balas
/api/admin/broadcast        Broadcast notifikasi ke anggota (scope)
/api/member/materi          Daftar materi
/api/member/store           Katalog & pesan produk
/api/member/pesan           Chat pengurus (tandai dibaca + unread)
/api/member/pindah          Ajuan pindah dojo
/api/member/piagam          Unggah piagam
/api/member/billing/[id]    Unggah bukti pembayaran iuran
/api/member/attendance/checkin  Check-in absensi GPS
/api/notifications/*        Notifikasi (admin ranting: filter scope dojo)
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

1. (Opsional) Sinkron **Inkai backend** agar billing UKT baru tidak menulis `uniqueTail` (frontend sudah bersih)  
2. Perkaya store (multi-item cart, pembayaran terintegrasi)  
3. Notifikasi push browser (di luar email Resend yang sudah opsional)  

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
| 18 Juli 2026 | Multi-akun per wilayah: beberapa email ADMIN_BRANCH/ADMIN_DOJO per cabang/ranting, PIC utama (AppSetting), proteksi nonaktif akun terakhir, panel Akun + API `/wilayah-accounts`, audit & notifikasi rekan |
| 18 Juli 2026 | Paket lanjutan multi-akun: satu jalur akun (form create tanpa login), jabatan, handover PIC + riwayat, PIC notifikasi prioritas & kontak resmi, konfirmasi nonaktif/reset, empty CTA, checklist kirim kredensial |
| 18 Juli 2026 | Paket ops admin lengkap: nav dikelompokkan + notifikasi, beranda role-aware, absensi rekap/belum hadir/export, iuran generate bulan + label ID + export, kegiatan edit/roster, verifikasi triage, anggota CSV+bulk approve, store/materi/carousel upload & lifecycle |
| 18 Juli 2026 | Paket lengkap celah ops: pesan unread+cari+broadcast, organisasi→pengaturan deep-link, geofence pratinjau peta, audit filter/export, beranda KPI pesan, preset peran |
| 18 Juli 2026 | Beranda anggota: checklist keanggotaan+CTA, dojo/jadwal/absen hari ini/PIC WA, aksi cepat kontekstual+sheet lainnya, badge pesan unread, agenda gabungan |
| 18 Juli 2026 | Seed akun Pengprov Jatim (`ADMIN_PROVINCE`): `pengprovjatim@gmail.com` via `scripts/seed-pengprov-jatim.ts` |
| 18 Juli 2026 | Fix admin UKT: `redirect()` URL kanonik tidak lagi tertangkap sebagai gagal API; periode dari query digabung ke daftar event; resolusi periode longgar + limit events 200 agar kartu batas pendaftaran (tanggal/jam) tidak hilang |
| 18 Juli 2026 | UKT: kolom Aksi menampilkan **Hasil Ujian Lulus** otomatis jika status Selesai + Kyu Baru sudah terisi (`resolveEffectiveUktExamResult`) |
| 18 Juli 2026 | UKT admin: label kolom **Sabuk saat ini → Kyu Lama**, **Sabuk target → Kyu Baru** |
| 18 Juli 2026 | Admin anggota: cabang dapat **edit kolom Sabuk** inline (`PATCH set_rank` + riwayat MemberRank) |
| 18 Juli 2026 | Percepat detail anggota: fetch member/billing/lifecycle/impact paralel + soft-fail Prisma; sheet tampil data baris segera |
| 18 Juli 2026 | Wizard periode UKT: field **tanggal + jam 24 jam** batas pendaftaran di langkah 1 (default akhir semester) |
| 18 Juli 2026 | UKT admin: dropdown Semester I/II lebih lebar & kontras jelas (tanpa highlight kuning accent) |
| 18 Juli 2026 | UKT: tombol/banner **Buat Periode** tampil jika belum ada periode berjudul semester+tahun (tidak lagi tersembunyi hanya karena `period` di URL) |
| 18 Juli 2026 | UKT: ikon **Back** (←) mengarah ke `?create=1` agar tombol **Buat Periode** muncul tanpa auto-pilih event |
| 18 Juli 2026 | UKT Laporan WA cabang: ringkas — Total Ranting, List Ranting (= N peserta), Jumlah per kyu, TOTAL peserta; filter ranting tetap format daftar nama |
| 18 Juli 2026 | UKT Export: dialog pilih ranting + Print / CSV / PDF; format daftar peserta ujian (NIA, TTL, JK, alamat, Kyu, Kyu Baru, Ranting) |
| 18 Juli 2026 | Cetak Nota UKT: hilangkan tombol X ganda; logo INKAI lebih dekat ke teks kop |
| 18 Juli 2026 | Paket UKT komplit: pejabat dinamis (kebijakan), hari-H roster+hasil massal, setoran ranting↔cabang, arsip/kunci periode, export validasi+pratinjau, toolbar Dokumen |
| 18 Juli 2026 | UKT: tombol **Buat Periode** dipindah ke toolbar kiri Export/Dokumen (banner info saja) |
| 18 Juli 2026 | UKT: hapus banner info “Periode … belum dibuat” — cukup tombol toolbar |
| 18 Juli 2026 | UKT toolbar: keluarkan semua aksi dari dropdown Dokumen jadi tombol terpisah |
| 19 Juli 2026 | Nav admin: Iuran Anggota, UKT, Event & Kegiatan, Absensi jadi item top-level (bukan grup Keuangan/Kegiatan) |
| 19 Juli 2026 | Deteksi duplikat anggota: NIK/NIA/nama+TTL (keras) + nama (lunak); blok admin create & daftar publik; UI peringatan |
| 19 Juli 2026 | Merge duplikat: ranting/cabang gabungkan akun mandiri ↔ data ranting; reparent iuran/absensi; arsipkan duplikat |
| 19 Juli 2026 | Kelola Anggota: kolom Terdaftar (tanggal + jam) di tabel + export CSV |
| 19 Juli 2026 | Ranting/cabang dapat edit Iuran/bln per anggota (detail anggota); generate tagihan pakai nominal per anggota |
| 19 Juli 2026 | Nav: Pengaturan User digabung ke Pengaturan Ranting & User; cabang dapat ubah email login ranting (change_email) |
| 19 Juli 2026 | Pengaturan cabang/ranting: klasifikasi error Prisma (sibuk vs gagal), KPI/filter login tidak menyesatkan saat username gagal dimuat |
| 19 Juli 2026 | Teknis: Unduh PDF UKT native (jspdf+html2canvas); email Resend di notifyUser (pesan/verifikasi/UKT); hapus helper uniqueTail; email reset-password ke ranting |
| 19 Juli 2026 | Pengaturan ranting: form Ubah Data/Tambah menampilkan email + password (cabang); PATCH mengembalikan kredensial bila password di-set |
| 19 Juli 2026 | Admin topbar: ikon **Back** di halaman konten (kecuali beranda; nested → parent path) |
| 19 Juli 2026 | Logout: dialog konfirmasi elegan sebelum `signOut` (menu admin/anggota + header beranda anggota) |
| 19 Juli 2026 | Beranda mobile: logo INKAI di atas sendiri; badge hero **Kota Surabaya** (bukan Cabang Surabaya) |
| 19 Juli 2026 | Beranda hero: lockup **Kota Surabaya** memakai emblem resmi Suro–Boyo (tanpa lingkaran emas) + Kota Pahlawan |
| 19 Juli 2026 | Beranda hero: lockup Kota Surabaya dipindah di bawah judul Institut Karate-Do Indonesia |
| 19 Juli 2026 | Kelola Anggota: pencarian autocomplete (debounce, tanpa tombol Filter); ranting: nonaktif/aktif + hapus/arsip koreksi; cabang: hapus/arsip penuh |
| 19 Juli 2026 | Ranting: kolom Aksi boleh **Hapus / arsipkan** untuk semua status (aktif/ber-NIA wajib ketik nama); API soft-delete selaras |
| 19 Juli 2026 | Fix multi-ranting Kelola Anggota: tabel anggota selalu via Prisma (bukan Inkai API single-dojo) agar selaras KPI & pilihan ranting |
| 19 Juli 2026 | Kelola Anggota: Export CSV digabung ke baris aksi (Tambah / Arsip), bukan baris terpisah di atas tabel |
| 19 Juli 2026 | Pengaturan ranting: form Ubah Data lengkap (multi-dojo) via Prisma; tidak lagi salah tampil "managedDojoId kosong" saat >1 ranting |
| 19 Juli 2026 | Multi-ranting per akun: AppSetting `user.managedDojos.*`, panel Akun (Multi/Tautkan), matriks cabang, context switcher anggota, RBAC `managedDojoIds` |
| 19 Juli 2026 | Pengaturan admin ranting: hapus duplikat email/password di Ubah Data; ganti email+password hanya di Akun Saya |
| 19 Juli 2026 | Paket keamanan+performa P0–P2: pesan IDOR ditutup; verifikasi fail-closed+scope; rate limit async/Upstash; CSRF admin; password register; audit upload/broadcast/verifikasi; cache badge pesan; KPI anggota groupBy; attendance scoped; chunk broadcast/generate; index Prisma; polling diperlambat |
| 19 Juli 2026 | Kelola Anggota: floating bar multi-select + **Hapus / arsipkan** massal (ketik ARSIPKAN); API bulk `delete` |
| 19 Juli 2026 | Notifikasi admin: scope per ranting (filter inbox ADMIN_DOJO); daftar mandiri kegiatan → notif ranting+cabang saja; badge ranting di bell |
| 19 Juli 2026 | Form Tambah Anggota / identitas: field teks otomatis **HURUF BESAR** (UI + API create/register) |
| 19 Juli 2026 | Tanggal lahir form identitas: paste fleksibel (`28 Februari 2011`, `28/02/2011`, ISO) |
| 19 Juli 2026 | Tambah Anggota (ranting/cabang): **NIK opsional** — kosong tetap tersimpan (null, bukan `""`) |
| 19 Juli 2026 | Daftar mandiri publik: identitas **wajib lengkap** (NIK, JK, TTL, alamat, telepon); NIA tetap opsional |
| 19 Juli 2026 | Arsip anggota: multi-select + pilih semua + floating **Hapus permanen** (ketik HAPUS) + pulihkan massal (cabang) |
| 19 Juli 2026 | Fix bulk arsip: batas `memberIds` 500 + chunk client 100 — hindari "Data tidak valid" saat pilih >100 |
| 19 Juli 2026 | Bulk anggota: `memberIds` **tanpa batas max** (client tetap chunk 100) |
| 19 Juli 2026 | Kelola Anggota: seleksi checkbox **tetap** saat ganti page/pageSize (sessionStorage); pilih semua = halaman ini |
| 19 Juli 2026 | Bulk hapus/arsip: **progress bar %** + chunk 25; tombol tampil persen saat memproses |

---

*Dokumen ini living inventaris organisasi (bukan laporan sekali-jadi) dan dapat dilampirkan pada presentasi pengurus Cabang / Pengprov.*
