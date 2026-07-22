# Laporan Inventaris Sistem — INKAI Surabaya

**Aplikasi:** Portal web Institut Karate-Do Indonesia (INKAI) Cabang Surabaya  
**Repository:** `inkai-sby`  
**Platform:** Next.js (App Router) + Inkai API + PostgreSQL (Supabase/Prisma)  
**Tanggal dokumen:** 20 Juli 2026  
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
| Notifikasi | Aktif | Notifikasi **akun sendiri** saja (filter fan-out Inkai + sembunyikan notif ops admin) |
| Pesan | Aktif | Chat dengan pengurus |
| Pindah Dojo | Aktif | Ajuan pindah ranting → verifikasi |
| Panduan | Aktif | Panduan penggunaan |
| Riwayat | Aktif | Kegiatan yang sudah lewat |

---

## 6. Portal admin (`/admin`)

| Modul | Fungsi |
|-------|--------|
| Beranda Admin | KPI anggota, iuran pending, event, verifikasi, **pesan unread**; aksi cepat role-aware + notifikasi; **ikon back** di topbar (kecuali beranda) |
| Kelola Anggota | Cari **autocomplete**; kolom **No**; **sort kolom** (NIA, Nama, Sabuk, Status, Dojo, Terdaftar — ikon naik/turun, server-side); KPI status + **Dok. kurang** + **Tanpa NIA**; **upload Akte/BPJS** di detail; pratinjau modal + print; detail, NIA; **Terdaftar**; **edit Iuran/bln**; **pindah ranting inline (cabang)**; nonaktif/bulk; CSV; arsip; Prisma scoped (+ **anggota luar Surabaya / ranting arsip** tetap terlihat); filter client-side; **Input Massal** (NIA…Kyu…Ranting, isi semua Kyu/DAN, progress %, maks 50); detail: **username login dari Prisma** (bukan hint palsu); **Reset password** sementara (ranting/cabang) |
| Iuran Anggota | Verifikasi + edit + lunas; **buat tagihan bulan**; filter bulan; label ID; **export CSV** |
| UKT | Nav grup **Pendaftaran** (`/admin/ukt`) + **Arsip UKT** (`/admin/ukt/arsip`); periode aktif, daftar peserta, **sort kolom**, multi-select ranting, **filter Gabungan multi-ranting**, bayar→verifikasi cabang, sabuk target, nota, **export**, **hari-H**, **setoran + rekonsiliasi**, **arsip**, wizard (ujian/pejabat/snapshot biaya); **toolbar atas sticky**; **ranting: Daftar/Batal/Bayar + toolbar Laporan WA & Cetak Nota**; cabang: **Hapus tagihan** terpisah dari hapus pendaftaran |
| Organisasi | Wilayah & pengurus; **deep-link** ke Pengaturan cabang/ranting |
| Verifikasi | Antrian klaim + **filter tipe/aging**; riwayat |
| Event & Kegiatan | Buat + **ubah/tutup** event non-UKT + **roster pendaftar**; link UKT |
| Materi Digital | CRUD + **upload Blob** + **publish/draft** |
| Store | CRUD produk (**edit/stok/aktif**) + status pesanan berlabel ID |
| Pesan | Inbox + unread badge, cari, balas, **broadcast notifikasi** |
| Absensi | Harian + **belum hadir** + **rekap semester %** + export |
| Carousel Beranda | Upload gambar + aktif + **urutkan** |
| Log Audit | Filter aksi/cari + **export CSV** (pusat) |
| Notifikasi | Inbox admin (ada di nav); **ranting: rantingnya + ops cabang**; field `audience`; tanpa notif pribadi anggota; cabang lihat semua ranting |
| Pengaturan | User digabung ke **Ranting & User**; cabang edit data ranting + **email/password** PIC di form Ubah Data; admin ranting: form **Ubah Data** lengkap (multi-ranting) + **email/password** di **Akun Saya**; multi-akun (Akun), kebijakan, **Pengaturan UKT (syarat daftar)**, peran (**preset**), geofencing (**pratinjau peta**), akun; **arsip cabang: Pulihkan + Hapus permanen** (ditolak jika masih ada anggota / cabang SURABAYA) |

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
1. Calon anggota daftar via `/login?tab=daftar` — form **Identitas lengkap wajib** (nama, JK, tempat/tgl lahir, alamat, **NIK 16 digit**, telepon; **NIA tetap opsional**), **Sabuk**, **Akun**, **Dojo**. **Tambah Anggota** oleh ranting/cabang: NIK/NIA boleh kosong. **Input Massal**: tabel NIA, Nama, **Tempat & Tgl Lahir** digabung, JK (teks), Alamat, Kyu, Ranting + **isi semua ranting** & **isi semua Kyu/DAN**; paste Excel/CSV (format lama dengan NIK/Telepon tetap didukung); simpan per chunk dengan **progress %**; maks 50 (`POST /api/admin/members/bulk-create`). Field teks identitas **huruf besar**; **tanggal lahir** bisa paste (mis. `28 Februari 2011` / `Surabaya, 28 Maret 2015`).
2. `POST /api/auth/register` dan `POST /api/admin/members` meneruskan semua field anggota (termasuk NIA jika diisi) ke Inkai API.
3. Status menunggu verifikasi (publik) atau aktif langsung (admin/ranting).
4. **Deteksi duplikat** sebelum simpan: **keras** jika NIK, NIA, atau nama tepat + tanggal lahir sama (cakupan Cabang Surabaya); **lunak** jika nama mirip. Blok `POST /api/admin/members` & `POST /api/auth/register` (409); UI peringatan di form tambah anggota & daftar publik.
5. **Gabungkan (merge)** oleh ranting/cabang di detail `/admin/anggota`: data operasional dipertahankan, akun login dari daftar mandiri dipindahkan, duplikat diarsipkan (`POST /api/admin/members/merge`). Cocok untuk kasus ranting daftar dulu (tanpa akun) lalu anggota daftar mandiri (PENDING + akun), atau sebaliknya.
6. Admin memverifikasi di `/admin/verifikasi` atau kelola anggota.
7. Cabang dapat mengisi **NIA** bila belum diisi saat pendaftaran, **mengedit sabuk**, dan **memindahkan ranting** anggota (kolom Dojo inline di `/admin/anggota`, `set_dojo`). Ajuan pindah dari anggota tetap lewat verifikasi `DOJO_TRANSFER`.
8. Anggota melengkapi profil & dokumen.
9. **Nonaktifkan** (status `INACTIVE` / `SUSPENDED`) — ranting/cabang; wajib alasan + catatan; notifikasi ke anggota; login diblokir; NIA & riwayat tetap; dapat **aktifkan kembali**. Bulk nonaktif tersedia.
10. **Reset password** di detail `/admin/anggota` (ranting/cabang): password tersimpan tidak ditampilkan; tombol **Reset password** membuat password sementara (pola `Nama####`), ditampilkan sekali untuk disalin.
11. **Hapus** = soft-delete (`isDeleted`) — cek dampak iuran/UKT; ranting & cabang dalam scope; aktif/ber-NIA wajib ketik nama. **Bulk hapus/arsip** dari floating bar (konfirmasi ketik `ARSIPKAN`). Arsip dapat dilihat & **dipulihkan** (jadi Nonaktif) oleh cabang; **bulk hapus permanen** di arsip (ketik `HAPUS`).

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
2. URL admin: **Pendaftaran** `/admin/ukt?semester=I|II&year=YYYY&period=<eventId>` (periode aktif) dan **Arsip UKT** `/admin/ukt/arsip?...` (riwayat/terkunci). Dropdown semester/tahun memilih event yang cocok; bila belum ada periode aktif, tombol **Buat Periode** di Pendaftaran.
3. **Ranting** mendaftarkan anggota (**Kyu Lama** = sabuk keanggotaan saat ini; setelah UKT selesai/sabuk naik, Kyu Lama dikunci dari snapshot registrasi).
4. Pendaftaran UKT: gate operasional dikonfigurasi di **Pengaturan → UKT** (`/admin/pengaturan/ukt`): centang iuran / dokumen / absensi (+ ambang %), serta **berlaku untuk ranting / cabang**. Periode buka/tutup selalu berlaku. Cabang tetap bisa waiver per anggota.
5. **Ranting** — aksi baris: **Daftar UKT**, **Batal UKT** (termasuk yang sudah bayar/lunas, scope ranting sendiri; notifikasi cabang + peringatan koordinasi pengembalian uang), **Bayar UKT** (= ajukan ke cabang → status **Menunggu Verifikasi** / `WAITING_VERIFICATION`, **bukan** lunas; cabang yang **Verifikasi** → lunas/**Menunggu Ujian**). Toolbar ranting tetap punya **Laporan WA** (buka WhatsApp siap kirim, bukan salin clipboard) dan **Cetak Nota** (manual — **tidak** otomatis saat daftar/Bayar). Setelah daftar, status **Belum Bayar**; cabang mendapat notifikasi otomatis saat daftar/batal/**Bayar UKT**. Tanpa setoran/tambah anggota di halaman UKT.
6. **Cabang** **memverifikasi pembayaran** (per baris / bulk; dari **Belum Bayar** atau **Menunggu Verifikasi**) → status **Menunggu Ujian**, lalu mencatat **hasil ujian**: `LULUS` / `GAGAL` / `MENGULANG`.
7. Alur cabang setelah bayar: **Verifikasi** → **Menunggu Ujian** → isi **Kyu Baru** → otomatis **Lulus** + **Selesai** (sabuk resmi naik). Status **Selesai** = lunas + Kyu Baru + LULUS.
8. Status operasional UKT disederhanakan untuk UI: **Belum Daftar / Belum Bayar / Menunggu Verifikasi / Menunggu Ujian / Lulus Ujian / Tidak Lulus / Mengulang / Selesai**.
9. Status **Selesai** bila sudah lunas + lulus + sabuk target terisi; sabuk resmi anggota diperbarui + riwayat.
10. Cetak nota memakai tabel biaya sabuk bulat; **tanpa kode unik** (+1…999). Nomor nota memuat semester (`UKT/SBY/{RANTING}/I|II/{tahun}`). Pejabat (Bidang Ujian / Bendahara) dari **period-meta per periode**, fallback **Pengaturan → Kebijakan**.
10b. **Biaya sabuk & komisi** di-**snapshot** ke period-meta saat buat/simpan periode; UI Atur Biaya default menyimpan ke snapshot periode (`updateGlobal: false`). Template global (`RankFeeTemplate` + setting komisi) hanya diubah bila tanpa periode atau opsi “juga update global” dicentang.
10c. Wizard periode: jadwal buka/batas + **tanggal/jam & tempat ujian** + pejabat; langkah biaya mencatat bahwa nominal akan di-snapshot; buat periode mengirim `notifyRanting: true`.
11. Jadwal pendaftaran: **buka** default awal semester + **batas** default akhir semester; cabang atur di wizard (langkah 1) atau **Atur** setelahnya. Gate daftar: sekarang ∈ [buka, batas]. Kartu jadwal menampilkan juga **ujian + tempat** dan **pejabat** bila ada. Timer hitungan mundur (hari/jam/menit/detik/ms) tampil **besar** di ruang kosong kiri kartu aksi toolbar.
11b. **Rekonsiliasi setoran** (kartu di UI **cabang**): tabel Ranting / Peserta / Lunas / Total / Status setor via `buildUktDepositReconciliation`; ranting tidak lagi menandai setor dari halaman UKT (diganti alur nota + verifikasi cabang).
11c. **Cron H-3** (`/api/cron/ukt-reminders`, `vercel.json`): pengingat batas daftar & notifikasi jadwal ke ranting (idempoten lewat `notified*` di period-meta).
11d. **Fokus periode aktif:** resolusi mengutamakan non-arsip; judul kanonis `UKT Semester {I|II}-{tahun}`; buat periode baru mengarsipkan term yang sudah tutup; sidebar **UKT → Pendaftaran / Arsip UKT** (bukan dropdown campuran); anggota hanya melihat periode aktif. Arsipkan dari Pendaftaran mengarahkan ke Arsip; buka arsip mengembalikan ke Pendaftaran. **Arsip UKT** hanya menampilkan peserta yang sudah mendaftar (tanpa pool “Belum Daftar”).
12. Dashboard anggota menampilkan **kartu Status UKT** di beranda & Prestasi (termasuk **jadwal ujian + lokasi** bila diisi); admin cabang: **export daftar peserta** (Print/Save as PDF/CSV + pilih ranting + validasi data; kolom **KYU** = sabuk keanggotaan), **Laporan WA** ringkas, **hari-H** (roster hadir + hasil massal), **status setoran** (cabang), **arsip/kunci periode**, waiver, wizard, action bar. Cabang & ranting dapat **membatalkan pendaftaran UKT beserta tagihan terkait, termasuk yang sudah lunas** (ranting: scope dojo + notifikasi cabang). Hapus hanya menyasar tagihan tertaut registrasi / UKT yatim (bukan semua iuran PAID anggota); bila API Inkai menolak karena tagihan lunas, server memakai **fallback Prisma**. Setelah hapus, anggota yang ikut ter-soft-delete dipulihkan agar bisa daftar UKT lain. Gate daftar memakai fallback Prisma bila GET anggota Inkai 404. Cabang dapat **menghapus tagihan UKT saja** (`DELETE /api/admin/billing/[id]`).
13. Toolbar cabang: **Buat Periode**, Hari-H, Export, Laporan WA, Cetak Nota, Biaya Sabuk, Arsip (tombol terpisah). Toolbar ranting: **Laporan WA** + **Cetak Nota** (manual).

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
| Pengaturan wilayah | Lengkap | Multi-akun satu pintu, jabatan, PIC, serah terima; **email/password PIC** di form Ubah Data ranting (cabang); admin ranting ubah email/password di **Akun Saya** (email bisa diedit); geofence + **pratinjau peta OSM**; degradasi username login: klasifikasi pool vs error lain, KPI/filter aman saat DB gagal; **multi-ranting per akun** (`AppSetting` + context switcher); arsip cabang **hapus permanen** (`permanent` pada DELETE cabang) |
| Upload bukti iuran (anggota) | Aktif | `/dashboard/iuran` + `/api/member/billing/[id]` |
| Scan/check-in absensi (anggota) | Aktif | `/dashboard/absensi` + `/api/member/attendance/checkin` |
| Absensi admin | Aktif | Harian, belum hadir, rekap semester %, export CSV |
| Iuran generate bulan | Aktif | `POST /api/admin/billing/generate` + UI Iuran |
| Nav admin | Campuran | Top-level: Iuran, Event, Absensi; **UKT** sebagai grup (Pendaftaran + Arsip UKT); grup: Keanggotaan / Konten / Sistem + badge unread pesan |
| Deteksi duplikat anggota | Aktif | Keras: NIK / NIA / nama+TTL (termasuk arsip untuk NIK/NIA); lunak: nama; admin create melepas NIA/NIK arsip bila hanya bentrok nomor; blok create admin & daftar publik; UI peringatan |
| Gabungkan duplikat | Aktif | Ranting/cabang: pindahkan akun login + riwayat ke data operasional; arsipkan duplikat |
| Audit admin | Aktif | Filter + export CSV di `/admin/audit` |
| Nominal UKT | Tanpa kode unik | Frontend tidak menulis `uniqueTail`; tampilan pakai `uktBaseFeeAmount` (+ strip data lama). Sinkron backend Inkai (opsional) |
| Unduh PDF UKT | Aktif | Tombol **Unduh PDF** di nota & export peserta (jspdf+html2canvas); Print tetap ada |
| Email notifikasi | Opsional (Resend) | `notifyUser` kirim email bila `RESEND_API_KEY`; dipakai pesan admin, verifikasi, UKT, lifecycle; reset-password email ke ranting |
| Eligibility UKT | Diterapkan | Gate periode tutup, iuran, dokumen, absensi semester minimum 75% |
| Hasil ujian UKT | Aktif | Cabang tetapkan `LULUS` / `GAGAL` / `MENGULANG`; Kyu Baru **wajib** setelah LULUS |
| Status UKT anggota | Aktif | `/api/member/ukt-status` + kartu status di beranda & Prestasi (CTA + jadwal ujian bila ada) |
| Filter/KPI UKT operasional | Aktif | Status UI selaras: Belum Bayar, Menunggu Verif/Ujian, Lulus, Selesai; kartu KPI **Gagal/Mengulang** memfilter kedua status |
| Pengecualian UKT (waiver) | Aktif | Cabang kecualikan iuran/dokumen/absensi + catatan audit |
| Kebijakan syarat UKT | Aktif | `/admin/pengaturan/ukt` — centang iuran/dokumen/absensi + enforce ranting/cabang (`AppSetting` `ukt.registration.policy`) |
| Export rekap UKT | Aktif | Daftar peserta (formulir): Print/Save as PDF/CSV + pilih ranting + validasi + pratinjau |
| UKT hari-H | Aktif | Roster kehadiran di tempat + hasil massal LULUS/GAGAL/MENGULANG |
| Setoran UKT | Aktif | Ranting tandai setor → cabang konfirmasi; **rekonsiliasi** peserta/lunas/tagihan vs status setor |
| Arsip periode UKT | Aktif | Kunci periode (blok daftar/ubah); export tetap |
| Snapshot biaya UKT | Aktif | `beltFees` + `komisiRanting` di period-meta; Atur Biaya default period-only; global opsional |
| Jadwal ujian UKT | Aktif | `examAt` + `examLocation` di period-meta; wizard + kartu jadwal + kartu anggota |
| Pejabat UKT per periode | Aktif | `bidangUjianName` / `bendaharaCabangName` di meta; fallback kebijakan cabang; dipakai nota |
| Notifikasi ranting UKT | Aktif | `notifyRanting` saat buat/ubah periode; cron H-3 `/api/cron/ukt-reminders` |
| Notifikasi UKT | Aktif | Otomatis ke anggota saat daftar, verifikasi bayar, hasil ujian, selesai |
| Ketergantungan API | Ada | Halaman degrade jika API sibuk/timeout |
| Email & Blob | Opsional | Perlu env production |
| Keamanan P0–P2 | Diperkuat | Pesan IDOR ditutup; verifikasi fail-closed; rate limit Upstash opsional; CSRF admin ketat; password register; audit upload/broadcast/verifikasi |
| Performa admin | Diperkuat | Badge pesan di-cache 45s; KPI anggota 1× groupBy; absensi/UKT scoped; overlay nav non-blocking; pageSize maks 100; aksi iuran/verifikasi/UKT optimistic; pesan soft-reload |

| Index Prisma | Ditambah | Member/Billing/Attendance/Verification/Message — jalankan migrate/db push di production |
| Pool DB Supabase | Diperkuat | Transaction `:6543`+`pgbouncer`; `connection_limit=5`/`pool_timeout=20`; soft-delete & **purge massal batch** (`deleteMany` per relasi); chunk purge 25 + jeda/retry; toast sibuk |

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
/api/admin/members          POST create; GET list+KPI counts (filter cepat client-side)
/api/admin/members/bulk-create  Input massal tambah anggota (maks 50)
/api/admin/members/[id]     Detail + aksi (approve/NIA/set_rank/set_dojo/set_dues/dokumen/reset_password/nonaktif/hapus/restore/merge)
/api/admin/members/bulk     Bulk nonaktif / approve / hapus-arsip (ARSIPKAN) / purge arsip (HAPUS) / restore
/api/admin/members/archived Daftar arsip soft-delete
/api/admin/billing/[id]     Edit tagihan, **submit_for_verification** (ranting→Menunggu Verifikasi), verifikasi/tandai lunas, **hapus** (ranting/cabang; force lunas = cabang; fallback Prisma bila API gagal)
/api/admin/billing/generate Buat tagihan iuran bulanan massal
/api/admin/ukt/registrations/[id]  Update/hapus pendaftaran UKT (`submit_for_verification` / `mark_paid` / Kyu; cabang force hapus: API lalu fallback Prisma shared DB)
/api/admin/ukt/table        Refresh cepat tabel UKT (snapshot registrasi/tagihan periode, merge ke rows lokal)
/api/admin/ukt/*            Periode, register, waiver, nota, hasil ujian, fees (snapshot/global), Kyu, exam-day, deposit, period-meta, hapus pendaftaran + tagihan terkait
/api/cron/ukt-reminders     Cron H-3 pengingat UKT (batas daftar / jadwal ranting)
/api/admin/account-peers   Email akun ranting gabungan (overlap managed dojos) untuk topbar ganti akun
/api/admin/pengaturan/*     User, cabang, ranting, wilayah-accounts, roles, geofencing, akun, kebijakan (pejabat dokumen), **ukt** (syarat daftar)
/api/admin/verifications/*  Proses klaim
/api/admin/carousel/*       Carousel beranda
/api/admin/upload           Upload ke Blob
/api/admin/document-file    Proxy pratinjau dokumen anggota (modal + print)
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
/api/notifications/*        Notifikasi (anggota: akun sendiri; admin ranting: ranting+ops cabang; tanpa notif pribadi anggota)
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
| 19 Juli 2026 | Fix arsip anggota: error "Gagal memproses aksi" = pool Supabase **EMAXCONNSESSION**; soft-delete tanpa interactive tx; toast sibuk; bulk chunk 10 + jeda/retry |
| 19 Juli 2026 | Fix bulk nonaktif: sama pool sibuk; `deactivateMember` catch 503; Prisma auto-alihkan Supabase pooler `:5432`→`:6543`+pgbouncer |
| 19 Juli 2026 | Fix KPI Kelola Anggota cabang: daftar+KPI satu sumber Prisma + `buildMemberFilter` (bukan Inkai vs Prisma unscoped) |
| 19 Juli 2026 | Kelola Anggota: kolom **No** (nomor urut lintas halaman) di tabel |
| 19 Juli 2026 | Kelola Anggota: KPI card navigasi `startTransition` + prefetch (tanpa flash AdminLoading) |
| 19 Juli 2026 | KPI **Dok. kurang** & **Tanpa NIA**: angka nyata (Prisma scoped) + filter daftar server-side |
| 19 Juli 2026 | Kolom Dokumen anggota: modal pratinjau (ukuran + Print), bukan tab baru; proxy `/api/admin/document-file` |
| 19 Juli 2026 | Admin upload Akte/BPJS di detail anggota (`set_documents` + Blob); sinkron Prisma + Inkai PATCH |
| 20 Juli 2026 | Fix crash Kelola Anggota: KPI ikon pakai nama string (bukan komponen Lucide ke Client Component) |
| 20 Juli 2026 | Percepat bulk arsip: `updateMany` + Inkai DELETE background; chunk 50 (bukan tunggu API per anggota) |
| 20 Juli 2026 | Kelola Anggota: filter Dojo via Prisma (`fetchAdminDojosScoped`) bukan Inkai API; dark mode native `<select>` (`color-scheme` + bg/text) |
| 20 Juli 2026 | Fix NIA “sudah digunakan”: bentrok dengan arsip (mis. `25.34533` milik ABDUL AZIZ AL-AMIN); deteksi arsip + lepas NIA/NIK arsip saat tambah anggota |
| 20 Juli 2026 | Fix pratinjau PDF Akte/BPJS: CSP izinkan `frame-src`/`object-src` `blob:` (Chrome “This content is blocked”) + tombol Tab baru |
| 20 Juli 2026 | Percepat filter Kelola Anggota: client fetch `GET /api/admin/members` (bukan full RSC); cache KPI/dojo; query docs/NIA dirampingkan |
| 20 Juli 2026 | Input Massal Tambah Anggota: tabel NIA…Ranting, template CSV, paste Excel, API `bulk-create` (maks 50) |
| 20 Juli 2026 | Fix error NIA: cari pemilik global (bukan hanya Surabaya); pesan sebut nama+dojo+cabang+ARSIP (mis. ABDUL AZIZ · JAKARTA) |
| 20 Juli 2026 | Input Massal: isi semua ranting; JK teks (paste); Tempat&Tgl lahir digabung (`Surabaya, 28 Maret 2015`) |
| 20 Juli 2026 | Input Massal: kolom Kyu saat ini teks (bisa paste), saran via datalist |
| 20 Juli 2026 | Fix “Database sibuk” saat hapus permanen arsip (1 user): purge batch `deleteMany` (bukan N× query/anggota); pool `connection_limit=5`; chunk purge 25 |
| 20 Juli 2026 | Input Massal: paste Kyu 1 sel Excel tidak lagi jadi baris baru; placeholder Kyu “boleh kosong” |
| 20 Juli 2026 | Input Massal: hapus kolom NIK/Telepon; **isi semua Kyu/DAN**; progress bar persentase saat simpan (chunk 5) |
| 20 Juli 2026 | Input Massal: urutan Tempat&Tgl sebelum JK; lebar kolom disesuaikan (table-fixed) |
| 20 Juli 2026 | Input Massal: angka Kyu (`4`) → `Biru (Kyu 4)`; lebar kolom diperlebar; error validasi lebih jelas; kirim `name` ke Inkai |
| 20 Juli 2026 | Input Massal: progress % naik per anggota (chunk 1) + bar persentase lebih jelas |
| 20 Juli 2026 | Fix KPI Total vs subtitle anggota: hapus cache 30s counts; `all` dari `count()`; samakan dengan total daftar |
| 20 Juli 2026 | Input Massal: Isi semua Kyu/DAN = select langsung isi kolom; paste kosong tidak lagi default Putih jika sudah dipilih |
| 20 Juli 2026 | Fix bocor URL Blob di field dokumen anggota: UI tampilkan status + unggah (bukan URL mentah) |
| 20 Juli 2026 | Upload dokumen Akte/BPJS: kompres otomatis ke maks. 150 KB (JPEG client-side) |
| 20 Juli 2026 | Kelola Anggota: cabang dapat **pindah ranting** via kolom Dojo inline (`set_dojo` → Inkai + Prisma) |
| 20 Juli 2026 | Pesan bentrok NIA lintas cabang: tegaskan bukan arsip Surabaya; NIA masih aktif di cabang lain (unik nasional) |
| 20 Juli 2026 | Pengaturan Cabang: arsip punya **Hapus** permanen (tolak jika masih ada anggota; cabang SURABAYA dilindungi) |
| 20 Juli 2026 | Kelola Anggota: tampilkan anggota luar Surabaya / ranting terarsip (mis. JAKARTA PUSAT) agar NIA & arsip cabang bisa dibersihkan |
| 20 Juli 2026 | Fix simpan password PIC ranting: update `User.passwordHash` lokal (bukan Inkai PATCH) — hilangkan error "Data tidak valid password baru ranting" |
| 20 Juli 2026 | Pengaturan ranting: telepon maks 60 karakter (dukung 2 nomor dipisah `/`) |
| 20 Juli 2026 | Input Massal: logo INKAI animasi saat progress menyimpan anggota |
| 20 Juli 2026 | Fix Kelola Anggota crash: filter luar Surabaya — `name.not` + `mode` (bukan `not.equals.mode`) |
| 20 Juli 2026 | Fix filter ranting kosong: sintaks Prisma `name.not`, bust cache dojo `v3`, jangan cache hasil error `[]` |
| 20 Juli 2026 | Kelola Anggota + UKT: header kolom tabel bisa sort A-Z/Z-A (ikon naik/turun); anggota server-side via `sort`/`sortDir` URL |
| 21 Juli 2026 | Fix biaya sabuk UKT: matching template (`Sabuk Biru`/`Coklat`) + jangan reuse ID salah; wizard & Atur Biaya sabuk satu sumber nominal; perbaiki data RankFeeTemplate korup |
| 21 Juli 2026 | Wizard periode UKT: field **Tanggal buka pendaftaran** (+ jam); gate daftar [buka–batas]; simpan di period-meta |
| 21 Juli 2026 | Banner jadwal UKT (batas lewat / belum buka): soft blink + glow elegan |
| 21 Juli 2026 | Paket UKT komplit UI: snapshot biaya per periode, jadwal/tempat ujian + pejabat di wizard & kartu, rekonsiliasi setoran, pejabat nota dari period-meta, kartu anggota tampilkan ujian, inventaris §9.3/§11 |
| 21 Juli 2026 | UKT fokus aktif vs riwayat: judul kanonis, buat periode baru arsipkan yang tutup, dropdown Aktif/Arsip, anggota fokus periode non-arsip |
| 21 Juli 2026 | Nav UKT: sub-menu **Pendaftaran** (periode aktif) + **Arsip UKT** (`/admin/ukt/arsip`); arsipkan/buka arsip pindah antar halaman |
| 21 Juli 2026 | Arsip UKT: sembunyikan anggota belum daftar (tabel, KPI, filter status, pencarian) |
| 21 Juli 2026 | Fix gate daftar UKT ranting: absensi null/0% & dokumen/iuran ditegakkan di UI+API (fail-closed) |
| 21 Juli 2026 | Sementara: ranting boleh daftar UKT tanpa gate iuran/dokumen/absensi (`UKT_ENFORCE_ELIGIBILITY_FOR_RANTING=false`); cabang tetap ketat |
| 21 Juli 2026 | Pengaturan UKT cabang: centang syarat daftar (iuran/dokumen/absensi) + berlaku ranting/cabang; ganti flag hardcode |
| 21 Juli 2026 | UKT UI lebih responsif: update status lokal segera setelah daftar/batal/verifikasi/hasil; refresh server di background |
| 21 Juli 2026 | UKT perf: tanpa soft-refresh setelah aksi baris; parallel org/policy+dashboard; period-meta paralel; notify daftar non-blocking; bulk verifikasi concurrent; page size maks 100 |
| 21 Juli 2026 | Perf admin lintas halaman: overlay navigasi `pointer-events-none` + min loader lebih singkat; pageSize maks 100 (bukan 1000); MemberActions tanpa double refresh; iuran/verifikasi hide kartu optimistic; pesan kirim tanpa full reload list |
| 21 Juli 2026 | Laporan WA UKT: ranting = daftar peserta + nama dojo login; cabang tetap ringkas (Total Ranting / List / Jumlah kyu) |
| 21 Juli 2026 | Export PDF/CSV/print UKT: kolom KYU (lama) terisi — snapshot atau infer satu tingkat di bawah Kyu Baru |
| 21 Juli 2026 | Tabel UKT: kolom Kyu Lama tampil (infer bila snapshot "—" / hilang setelah isi Kyu Baru) |
| 21 Juli 2026 | Fix notifikasi anggota: inbox `/dashboard/notifikasi` + bell hanya akun sendiri; sembunyikan notif ops admin (fan-out Inkai) |
| 21 Juli 2026 | Fix notifikasi admin: ranting hanya notif rantingnya + ops cabang; semua admin sembunyikan notif pribadi anggota (fan-out) |
| 21 Juli 2026 | Paket notifikasi komplit: fix akar `notifyAdmins` (jangan fan-out semua user), field `audience`, cleanup DB, filter+log+test di sby |
| 21 Juli 2026 | Fix filter KPI UKT: kartu **Gagal/Mengulang** di `/admin/ukt` kini menampilkan peserta status `GAGAL` dan `MENGULANG` sekaligus |
| 21 Juli 2026 | UKT admin: hapus peserta dari kolom Aksi juga menghapus tagihan UKT terkait, termasuk yang sudah `PAID`, dengan dialog konfirmasi yang menyebut dampaknya |
| 21 Juli 2026 | UKT Pendaftaran: timer floating hitungan mundur (hari/jam/menit/detik/ms) ke batas pendaftaran, fixed saat scroll, glassmorphism + aksen inkai-red |
| 21 Juli 2026 | UKT timer: mode H-2 darurat (≤48 jam) — strip h-2 berdenyut, glow merah, label H-2 · Darurat |
| 21 Juli 2026 | UKT jadwal: badge **Masih terbuka** animasi glow lembut (`ukt-open-badge`) |
| 21 Juli 2026 | UKT UI polish: hilangkan judul ganda (topbar cukup), toolbar **Lainnya** (Syarat/Biaya/Arsip), kartu jadwal grid 2 kolom, sembunyikan Nota Terpilih kosong, badge terbuka pakai titik pulse |
| 21 Juli 2026 | UKT: timer kompak inline di kanan badge **Masih terbuka** (bukan floating); hapus judul periode & kontrol semester/tahun dari kiri kartu aksi |
| 21 Juli 2026 | UKT: timer besar elegan mengisi ruang kosong kiri kartu aksi (sebelah kiri Laporan WA) |
| 21 Juli 2026 | Fix hapus paksa peserta UKT lunas: kirim `billingId`+`force`, resolve tagihan multi-sumber, coba DELETE/PATCH force sebelum hapus registrasi |
| 22 Juli 2026 | UKT: tombol **Hapus tagihan** (cabang) + `DELETE /api/admin/billing/[id]`; helper bersama `billing-delete.ts` |
| 22 Juli 2026 | Fix hapus peserta lunas: cari semua tagihan UKT anggota (bukan hanya billingId UI), sapu lalu retry DELETE registrasi; mapping billing UI diperbaiki |
| 22 Juli 2026 | Percepat hapus UKT: timeout 5s, hapus tagihan paralel + unlink dulu, toast loading di UI |
| 22 Juli 2026 | Force hapus UKT lunas: fallback Prisma (unlink billing + hapus EventRegistration); map billingId dari `/v1/billing` global |
| 22 Juli 2026 | UKT: toolbar atas (semester + timer + aksi) sticky di bawah topbar admin |
| 22 Juli 2026 | Kyu Lama UKT = sabuk keanggotaan; snapshot lama hanya dikunci setelah sabuk naik (selesai); kolom KYU di PDF/CSV ikut sama |
| 22 Juli 2026 | Daftar UKT ranting → status Belum Bayar (bukan Menunggu Ujian); mapping tagihan ketat by registrationId; notifikasi cabang otomatis |
| 22 Juli 2026 | UI ranting UKT dipangkas: hanya Daftar / Batal / Bayar UKT |
| 22 Juli 2026 | Ranting dapat Batal UKT meski sudah bayar/lunas (force + notifikasi cabang) |
| 22 Juli 2026 | Paket UKT ranting↔cabang: status Belum Bayar, UI 3 aksi, Bayar=nota (bukan lunas), batal lunas+peringatan refund, inventaris §9.3 |
| 22 Juli 2026 | Ranting Bayar UKT = `submit_for_verification` → Menunggu Verifikasi (bukan lunas); cabang Verifikasi yang menandai lunas |
| 22 Juli 2026 | UKT cabang: Hapus/Batal langsung update tabel+KPI+rekap tanpa F5; sync aman vs data server usang; refresh saat fokus tab |
| 22 Juli 2026 | Toolbar ranting: kembalikan Laporan WA + Cetak Nota; WA buka kirim manual (bukan copy); Daftar/Bayar tidak auto-buka nota |
| 22 Juli 2026 | UKT: tombol Reset filter + Refresh tabel (`GET /api/admin/ukt/table`) tanpa reload halaman |
| 22 Juli 2026 | Percepat Refresh UKT: snapshot registrasi/tagihan saja (bukan full dashboard), merge ke baris lokal |
| 22 Juli 2026 | Fix status UKT: Verifikasi → Menunggu Ujian (bukan Selesai); Selesai hanya setelah Lulus + Kyu Baru |
| 22 Juli 2026 | Alur cabang: Verifikasi → Menunggu Ujian → isi Kyu Baru → Lulus → Selesai |
| 22 Juli 2026 | Fix isi Kyu Baru: jangan gagal bila GET Inkai 404 — fallback Prisma + cek lunas via billing |
| 22 Juli 2026 | Isi Kyu Baru (cabang) otomatis Lulus + Selesai; kolom status/aksi langsung Selesai |
| 22 Juli 2026 | Ranting: status Selesai → aksi tampil Selesai (disabled), tanpa Batal UKT |
| 22 Juli 2026 | Fix daftar UKT ulang setelah cabang hapus peserta selesai: jangan hapus semua tagihan PAID anggota; pulihkan soft-delete; fallback Prisma bila Inkai GET anggota 404 |
| 22 Juli 2026 | Fix ranting daftar UKT "Akses wilayah ditolak": jangan PATCH anggota pakai token ranting; fallback daftar+tagihan via Prisma (atau INKAI_SERVICE_TOKEN) setelah cek scope dojo |
| 22 Juli 2026 | Filter ranting UKT cabang: opsi **Gabungan** dari akun multi-ranting (mis. Gabungan GADING · CAKRA, MANYAR) |
| 22 Juli 2026 | Fix UKT ranting multi: load anggota+registrasi semua managed dojo via Prisma; filter + kolom Ranting di UI ranting |
| 22 Juli 2026 | Topbar admin: daftar email akun gabungan multi-ranting + pindah akun cepat (prefill Ganti Akun) |
| 22 Juli 2026 | Fix detail anggota: overlay username/telepon dari Prisma; hapus hint password palsu (`nama+123`); tombol **Reset password** sementara (ranting/cabang, `PATCH reset_password`) |

---

*Dokumen ini living inventaris organisasi (bukan laporan sekali-jadi) dan dapat dilampirkan pada presentasi pengurus Cabang / Pengprov.*
