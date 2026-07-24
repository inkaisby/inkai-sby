# Laporan Inventaris Sistem — INKAI Surabaya

**Aplikasi:** Portal web Institut Karate-Do Indonesia (INKAI) Cabang Surabaya  
**Repository:** `inkai-sby`  
**Platform:** Next.js (App Router) + Inkai API + PostgreSQL (Supabase/Prisma)  
**Tanggal dokumen:** 23 Juli 2026  
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

**Environment utama:** `INKAI_API_URL`, `DATABASE_URL`, `AUTH_SECRET` / `NEXTAUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `IMPERSONATION_ENABLED` (opsional; default on kecuali `"false"`).

---

## 4. Fitur website publik

| Route | Fungsi |
|-------|--------|
| `/` | Beranda, carousel berita, **cuplikan Apresiasi**, CTA login/daftar; **floating chip kegiatan terbuka** di seluruh layout publik |
| `/tutorial` | **Tutorial anggota** (langkah + slot embed YouTube): pendaftaran, menu dashboard, UKT, iuran, absensi; CTA Daftar/Masuk; nav header **Tutorial** |
| `/sejarah` | Sejarah organisasi |
| `/makna-lambang` | Filosofi lambang |
| `/visi-misi` | Visi & misi |
| `/struktur` | Struktur cabang–ranting & pengurus |
| `/struktur/print` | Versi cetak struktur |
| `/kegiatan` | Daftar kegiatan (+ badge **Masih terbuka** / **Berlangsung**; UKT terbuka → undangan) |
| `/kegiatan/[id]` | Detail kegiatan |
| `/apresiasi` | Kenangan (in memoriam) & prestasi kurasi admin; filter tab |
| `/dojo` | Daftar dojo/ranting Cabang Surabaya (detail lengkap, tanpa jumlah anggota) |
| `/dojo/[id]` | Profil ranting/dojo |
| `/v/[id]` | Verifikasi kartu anggota (scan QR — UUID atau NIA) |
| `/kontak` | Kontak sekretariat |
| `/keamanan-siber` | Kebijakan keamanan siber |
| `/login` | Login & registrasi (form selaras admin: **Dojo → Identitas → Sabuk → Akun**; No. MSH opsional di Sabuk jika Hitam/DAN); **dual-role** (admin + anggota terhubung) default masuk `/dashboard`, pilih **Panel Admin** manual |
| `/daftar` | Redirect ke form daftar |
| `/lupa-password` | Ajuan reset password |
| `/reset-password` | Set password baru |
| `/undangan/ukt/[periodId]` | **Undangan portal UKT** (publik): cover buka + musik, section Home/Acara/Galeri/Peta (auto-play + klik tab + scroll), CTA login ke `/admin/ukt` |

---

## 5. Portal anggota (`/dashboard`)

| Modul | Status | Fungsi |
|-------|--------|--------|
| Beranda | Aktif | Kartu anggota, **checklist keanggotaan + CTA**, dojo/jadwal/**absen hari ini**/PIC, aksi cepat kontekstual, UKT, badge pesan+notif; **header sticky**; kegiatan via menu (bukan agenda di beranda); **dual-role: ikon Panel Admin** di header (sebelah logout) |
| Profil | Aktif | Edit lengkap (foto, identitas, dokumen); **email/NIA/sabuk/MSH edit mandiri 1×** lalu pengajuan `PROFILE_CHANGE`; No. MSH (Hitam/DAN) di Kartu Anggota |
| Absensi | Aktif | Streaming UI; check-in GPS multi-lokasi (auto geofence + override); biometrik HP opsional (WebAuthn); QR collapsible; riwayat; 1×/hari |
| Iuran | Aktif | Daftar tagihan + **lapor setor** (tanggal; nominal = tagihan; periode berjalan/**bulan sebelumnya**; tanpa unggah bukti TF) |
| Kegiatan | Aktif | Pendaftaran event (dengan gate kelengkapan); UKT lewat kartu Status UKT (daftar mandiri) |
| Materi Digital | Aktif | Katalog materi dari cabang (unduh/buka file) |
| Store | Aktif | Katalog produk + pesan (stok) |
| Prestasi & Sabuk | Aktif | Sabuk, unggah piagam, pelatihan |
| Dokumen | Aktif | Ringkasan Akte/BPJS; unggah/edit via Profil |
| Notifikasi | Aktif | Notifikasi **akun sendiri** saja (filter fan-out Inkai + sembunyikan notif ops admin) |
| Pesan | Aktif | Chat dengan pengurus |
| Pindah Dojo | Aktif | Ajuan pindah ranting → verifikasi |
| Panduan | Aktif | Langkah lengkap + slot video (`guide/member-tutorials.json`); welcome singkat di beranda |
| Riwayat | Aktif | Kegiatan yang sudah lewat |

---

## 6. Portal admin (`/admin`)

| Modul | Fungsi |
|-------|--------|
| Beranda Admin | KPI anggota, iuran pending, event, verifikasi, **pesan unread**; aksi cepat role-aware + notifikasi; **ikon back** di topbar (kecuali beranda); **dual-role: menu Dashboard Anggota**; **topbar chip kegiatan Masih terbuka** (pulse + rotasi judul + panel) |
| Kelola Anggota | Cari **autocomplete** (nama/NIA/**MSH**); kolom **No**; **sort kolom** (NIA, Nama, Sabuk, Status, Dojo, Terdaftar — ikon naik/turun, server-side); KPI status + **Dok. kurang** + **Tanpa NIA**; **ranting/cabang edit Nama** inline (`set_name`) + **Dokumen** (tombol Ubah di kolom / detail); **upload Akte/BPJS** di detail; pratinjau modal + print; detail, NIA; **No. MSH** (Hitam/DAN — kolom + edit ranting/cabang `set_msh`); **Terdaftar**; **edit Iuran/bln**; **pengecualian iuran (event/UKT)**; **pindah ranting inline (cabang)**; nonaktif/bulk; CSV (+ No. MSH); arsip; Prisma scoped (+ **anggota luar Surabaya / ranting arsip** tetap terlihat); filter client-side; **Input Massal** (NIA…Kyu…Ranting, isi semua Kyu/DAN, progress %, maks 50); detail: **username login dari Prisma** (bukan hint palsu); **Reset password** sementara (ranting/cabang) |
| Iuran Anggota | **Rekening koran per anggota** (tabel: No, Nama, NIA, Ranting, Iuran/bln, Status bulan, Tunggakan, Aging, **Pengecualian**); klik nama → Sheet **Pengaturan / Mutasi / Pembayaran**; strip antrian verifikasi; generate bulan; export rekap CSV; deep-link `?memberId=&tab=` |
| UKT | Nav grup **Pendaftaran** (`/admin/ukt`) + **Arsip UKT** (`/admin/ukt/arsip`); periode aktif, daftar peserta, **sort kolom**, multi-select ranting, **filter Gabungan multi-ranting**, bayar→verifikasi cabang, sabuk target, nota, **export**, **hari-H**, **setoran + rekonsiliasi**, **arsip**, wizard (ujian/pejabat/snapshot biaya); **toolbar atas sticky**; **ranting: Daftar/Batal/Bayar + toolbar Laporan WA, Salin/WA Undangan & Cetak Nota**; cabang: **Hapus tagihan** terpisah dari hapus pendaftaran; **undangan portal** `/undangan/ukt/[periodId]` |
| Organisasi | Wilayah & pengurus; **deep-link** ke Pengaturan cabang/ranting |
| Verifikasi | Antrian klaim + **filter tipe/aging**; riwayat |
| Event & Kegiatan | Buat + **ubah/tutup** event non-UKT + **roster pendaftar**; link UKT |
| Materi Digital | CRUD + **upload Blob** + **publish/draft** |
| Store | CRUD produk (**edit/stok/aktif**) + status pesanan berlabel ID |
| Pesan | Inbox + unread badge, cari, balas, **broadcast notifikasi** |
| Absensi | **Progress** tabel klik→Sheet + harian + belum hadir; **tab client instan** (tanpa delay navigasi); export; soft-backfill menu ranting |
| Carousel Beranda | Upload gambar + aktif + **urutkan** (Prisma lokal; cabang) |
| Apresiasi | CRUD kenangan & prestasi publik (`AppreciationEntry`); cabang saja |
| Log Audit | Filter aksi/cari + **export CSV** (pusat) |
| Kehadiran akun | **Sedang aktif** + jejak audit (IP, perangkat, lokasi CDN, UA); heartbeat; **cabut sesi / kunci / buka kunci**; **ambil alih (Mode A)** pusat/cabang; ranting tidak akses |
| Notifikasi | Inbox admin (ada di nav); **ranting: rantingnya + ops cabang**; field `audience`; tanpa notif pribadi anggota; cabang lihat semua ranting |
| Pengaturan | User digabung ke **Ranting & User**; cabang edit data ranting + **email/password** PIC di form Ubah Data; panel Akun: **Jadikan admin ranting** (email anggota existing → dual-role) + **centang hak akses** (edit profil, CRUD, menu sidebar); **Pengaturan Cabang** mendukung **Jadikan admin cabang** dari akun existing (mis. ketua cabang) tanpa akun baru + badge **Admin + Anggota / Admin saja**; admin ranting: form **Ubah Data** lengkap (multi-ranting) + **email/password** di **Akun Saya**; multi-akun (Akun), kebijakan, **Pengaturan UKT (syarat daftar)**, peran (**preset**), geofencing (**pratinjau peta**), akun; **arsip cabang: Pulihkan + Hapus permanen** (ditolak jika masih ada anggota / cabang SURABAYA) |

**Batasan admin ranting:** tanpa Organisasi, Carousel, **Apresiasi**, Audit, **Kehadiran akun**, serta sebagian submenu pengaturan tingkat cabang/pusat.

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

**Dual-role:** satu `User` dapat punya peran admin (`ADMIN_*`) sekaligus `memberId` (anggota terhubung). Setelah login → `/dashboard`; admin-only → `/admin`. Pindah portal lewat **ikon perisai Panel Admin** di header dashboard (sebelah logout) atau **Dashboard Anggota** (menu admin). JWT sesi di-refresh otomatis (~30 detik) agar promosi admin cabang/ranting langsung terdeteksi tanpa login ulang.

### 7.3 Matriks hak akses WILAYAH

| Area | User / Anggota | Ranting | Cabang | Pengprov |
|------|----------------|---------|--------|----------|
| Profil & akun | Edit profil sendiri | Edit **nama** + **dokumen** anggota (hak edit profil); tidak edit akun login | Lihat ranting & anggota di bawahnya | Lihat cabang, ranting & anggota di bawahnya |
| Kyu / DAN | Tidak edit sendiri | Tidak edit | **Edit Kyu (UKT & anggota)** | Tidak edit (hanya lihat) |
| Event (UKT, Gashuku, pertandingan) | Lihat & **daftar UKT mandiri** (+ konfirmasi bayar); daftar event non-UKT | Daftarkan anggota ranting; **Terima/Tolak** mandiri; Bayar UKT | **Buat event** + lihat pendaftar; Verifikasi bayar UKT | Lihat event & pendaftar |
| NIA | Lihat sendiri | Tidak assign | **Assign NIA** | Lihat saja |
| Iuran | Lihat & bayar sendiri | **Edit tagihan + verifikasi + lunas**; **edit Iuran/bln per anggota** (scope dojo) | **Kelola iuran** cabang (edit/verifikasi/lunas + Iuran/bln) | Lihat saja (tanpa edit) |
| Status keanggotaan | Lihat sendiri | **Nonaktifkan / aktifkan**; **hapus/arsip** (aktif/ber-NIA: ketik nama; bulk: ketik ARSIPKAN); **gabungkan duplikat** | **Nonaktif / aktif / hapus (arsip)** + bulk; gabungkan duplikat | Lihat saja |
| Kehadiran akun | Tidak lihat daftar | Tidak lihat | **Lihat + cabut/kunci/ambil alih** (scope cabang) | Tidak (khusus pusat/cabang) |

---

## 8. Entitas data utama

| Entitas | Isi penting |
|---------|-------------|
| `Province` / `Branch` / `Dojo` | Wilayah & ranting (termasuk geofence) |
| `User` / `Role` / `Permission` | Akun & RBAC (+ `lastLoginAt` / `lastSeenAt` kehadiran) |
| `UserSession` | Jejak sesi login: IP, UA, perangkat, lokasi CDN, timezone |
| `Member` | NIA, NIK, nama, sabuk, status, dokumen, dojo |
| `MemberRank` | Riwayat kenaikan sabuk |
| `Billing` / `Payment` | Tagihan & bukti bayar |
| `Event` / `EventCategory` / `EventRegistration` | Kegiatan & UKT |
| `Attendance` | Absensi (QR, lokasi) |
| `Verification` | Klaim verifikasi admin |
| `Notification` | Notifikasi |
| `NewsCarousel` | Konten beranda |
| `AppreciationEntry` | Kenangan & prestasi publik (lokal) |
| `Product` / `StoreOrder` / `StoreOrderItem` | Katalog store & pesanan anggota |
| `DigitalMaterial` | Materi digital |
| `Conversation` / `Message` | Pesan anggota–pengurus |
| `AppSetting` | Setting aplikasi (mis. komisi ranting) |
| `AuditLog` | Log audit |

**Catatan:** UKT tidak punya tabel terpisah; diwujudkan sebagai `Event` bertema UKT + pendaftaran + tagihan terkait.

---

## 9. Alur bisnis yang sudah berjalan

### 9.1 Keanggotaan
1. Calon anggota daftar via `/login?tab=daftar` — urutan **Dojo → Identitas lengkap wajib** (nama, JK, tempat/tgl lahir, alamat, **NIK 16 digit**, telepon; **NIA tetap opsional**) → **Sabuk** (**No. MSH opsional** hanya Hitam/DAN) → **Akun**. **Tambah Anggota** oleh ranting/cabang: NIK/NIA boleh kosong; **No. MSH opsional** (khusus Hitam/DAN, section Sabuk) disimpan ke Prisma saat create / daftar mandiri. **Input Massal**: tabel NIA, Nama, **Tempat & Tgl Lahir** digabung, JK (teks), Alamat, Kyu, Ranting + **isi semua ranting** & **isi semua Kyu/DAN**; paste Excel/CSV (format lama dengan NIK/Telepon tetap didukung); simpan per chunk dengan **progress %**; maks 50 (`POST /api/admin/members/bulk-create`). Field teks identitas **huruf besar**; **tanggal lahir** bisa paste (mis. `28 Februari 2011` / `Surabaya, 28 Maret 2015`).
2. `POST /api/auth/register` dan `POST /api/admin/members` meneruskan semua field anggota (termasuk NIA jika diisi) ke Inkai API.
3. Status menunggu verifikasi (publik) atau aktif langsung (admin/ranting).
4. **Deteksi duplikat** sebelum simpan: **keras** jika NIK, NIA, atau nama tepat + tanggal lahir sama (cakupan Cabang Surabaya); **lunak** jika nama mirip. Blok `POST /api/admin/members` & `POST /api/auth/register` (409); UI peringatan di form tambah anggota & daftar publik.
5. **Gabungkan (merge)** oleh ranting/cabang di detail `/admin/anggota`: data operasional dipertahankan, akun login dari daftar mandiri dipindahkan, duplikat diarsipkan (`POST /api/admin/members/merge`). Cocok untuk kasus ranting daftar dulu (tanpa akun) lalu anggota daftar mandiri (PENDING + akun), atau sebaliknya. **Registrasi-first:** bila kedua sisi punya `EventRegistration` untuk event yang sama (mis. UKT), registrasi milik data `keep` yang dipertahankan; duplikat di sisi `merge` **dihapus** (bukan menimpa) supaya tidak bentrok unique `(eventId, memberId)` — riwayat billing/absensi/rank tetap direparent ke `keep`.
6. Admin memverifikasi di `/admin/verifikasi` atau kelola anggota.
7. Cabang dapat mengisi **NIA** bila belum diisi saat pendaftaran, **mengedit sabuk**, dan **memindahkan ranting** anggota (kolom Dojo inline di `/admin/anggota`, `set_dojo`). Ranting & cabang dapat **mengedit nama** (`set_name`), **dokumen** Akte/BPJS (`set_documents`), dan **No. MSH** untuk sabuk Hitam/DAN (`set_msh`); perubahan MSH (mandiri, pengajuan, atau admin) **memberitahu admin ranting & cabang**. Ajuan pindah dari anggota tetap lewat verifikasi `DOJO_TRANSFER`.
8. Anggota melengkapi profil & dokumen (termasuk No. MSH mandiri 1× untuk Hitam/DAN).
9. **Nonaktifkan** (status `INACTIVE` / `SUSPENDED`) — ranting/cabang; wajib alasan + catatan; notifikasi ke anggota; login diblokir; NIA & riwayat tetap; dapat **aktifkan kembali**. Bulk nonaktif tersedia.
10. **Reset password** di detail `/admin/anggota` (ranting/cabang): password tersimpan tidak ditampilkan; tombol **Reset password** membuat password sementara (pola `Nama####`), ditampilkan sekali untuk disalin.
11. **Hapus** = soft-delete (`isDeleted`) — cek dampak iuran/UKT; ranting & cabang dalam scope; aktif/ber-NIA wajib ketik nama. **Bulk hapus/arsip** dari floating bar (konfirmasi ketik `ARSIPKAN`). Arsip dapat dilihat & **dipulihkan** (jadi Nonaktif) oleh cabang; **bulk hapus permanen** di arsip (ketik `HAPUS`).

### 9.2 Iuran
1. Tagihan iuran bulanan muncul di sistem (nominal dari **Iuran/bln** per anggota saat generate).
2. Anggota melihat tagihan di `/dashboard/iuran`, **menyetor manual ke ranting** (bukti fisik offline), lalu **melaporkan tanggal bayar** untuk tagihan yang ada **atau periode bulan sebelumnya** (maks. 24 bulan; nominal = Iuran/bln; tagihan dibuat otomatis bila belum digenerate). **Tanpa unggah** bukti TF. Status → `WAITING_VERIFICATION`.
3. **Ketua ranting / cabang** di `/admin/iuran` melihat **daftar anggota** (rekening koran) scoped ranting/cabang, dengan rekap tunggakan, status bulan, aging, dan kolom **Pengecualian** (tidak wajib lunas iuran untuk daftar event/UKT atau lainnya).
4. Klik nama anggota membuka Sheet rekening: **Pengaturan** (Iuran/bln + pengecualian), **Mutasi** (riwayat iuran bulanan; Debit/Kredit; metode + **tgl setor**; **Catat setor periode** oleh ranting/cabang), **Pembayaran** (setujui/tolak/tandai lunas laporan setor). Ranting/cabang dapat **hapus jejak aksi** lokal di Sheet.
5. Strip **Perlu aksi** menampilkan antrian `WAITING_VERIFICATION` (tgl setor) dengan setujui cepat. **Bulk lunas tunai** (centang anggota → tandai lunas periode filter) tetap ada jika anggota lupa lapor. **Catat setor ranting** (`POST …/report-setor`) selaras lapor setor anggota (buat tagihan bila perlu → menunggu verifikasi).
6. **Iuran/bln per anggota** dapat diubah di Sheet Iuran atau detail `/admin/anggota` (`PATCH set_dues`); generate tagihan bulanan memakai nominal per anggota bila ada, else default kebijakan; anggota pengecualian di-skip generate.
7. Status: `PENDING` → `WAITING_VERIFICATION` (lapor setor anggota) → `PAID` / ditolak. `Payment.paidAt` dari tanggal laporan anggota **dipertahankan** saat approve. Aksi lapor/verifikasi/lunas/edit menulis **jejak aksi** ke audit lokal + Inkai; tampil di Sheet Mutasi/Pembayaran.

### 9.3 UKT (Ujian Kenaikan Tingkat)
1. **Cabang** membuat periode UKT per semester (Semester I = Jan–Jun, Semester II = Jul–Des); setiap semester = **event terpisah** dengan registrasi & pembayaran sendiri.
2. URL admin: **Pendaftaran** `/admin/ukt?semester=I|II&year=YYYY&period=<eventId>` (periode aktif) dan **Arsip UKT** `/admin/ukt/arsip?...` (riwayat/terkunci). Dropdown semester/tahun memilih event yang cocok; bila belum ada periode aktif, tombol **Buat Periode** di Pendaftaran.
3. **Dual path daftar:** (a) **Ranting** mendaftarkan anggota langsung → **Belum Bayar**; (b) **Anggota** daftar mandiri dari kartu Status UKT (**Daftar UKT sekarang**) → **Menunggu Terima Ranting** (`PENDING`, tanpa tagihan dulu). **Kyu Lama** = sabuk keanggotaan saat ini.
3b. **Daftar mandiri:** gate syarat (periode, iuran, dokumen Akte+BPJS, absensi) di server dengan role `MEMBER`; **Pengecualian iuran** otoritas **ranting** (`allowEventWithoutDues`). UI anggota **tidak menampilkan nominal** biaya UKT (kartu + filter tagihan UKT dari `/dashboard/iuran`). Setelah daftar, anggota bayar offline ke ranting lalu **Konfirmasi sudah bayar** (flag saja). Unique `(eventId, memberId)` anti-bentrok.
3c. **Ranting Terima / Tolak** pengajuan mandiri: **Terima** = APPROVED + buat billing + `WAITING_VERIFICATION` (uang sah + teruskan cabang); **Tolak** = batalkan + notif (koordinasi pengembalian bila sudah konfirmasi bayar).
4. Pendaftaran UKT: gate operasional dikonfigurasi di **Pengaturan → UKT** (`/admin/pengaturan/ukt`): centang iuran / dokumen / absensi (+ ambang %), serta **berlaku untuk ranting / cabang**. Periode buka/tutup selalu berlaku. Cabang tetap bisa waiver multi-blocker; pengecualian iuran anggota lewat ranting.
5. **Ranting** — aksi baris: **Daftar UKT**, **Terima**/**Tolak** (mandiri), **Batal UKT**, **Bayar UKT** (= ajukan ke cabang → **Menunggu Verifikasi**; untuk jalur daftar ranting). Setelah daftar ranting: **Belum Bayar**. Notifikasi otomatis daftar/batal/Bayar/Terima.
6. **Cabang** **memverifikasi pembayaran** → **Menunggu Ujian**, lalu hasil ujian `LULUS` / `GAGAL` / `MENGULANG`.
7. Alur cabang setelah bayar: **Verifikasi** → **Menunggu Ujian** → isi **Kyu Baru** → otomatis **Lulus** + **Selesai**.
8. Status operasional UI: **Belum Daftar / Menunggu Terima Ranting / Menunggu Konfirmasi Ranting / Belum Bayar / Menunggu Verifikasi / Menunggu Ujian / Lulus Ujian / Tidak Lulus / Mengulang / Selesai**.
9. Status **Selesai** bila sudah lunas + lulus + sabuk target terisi; sabuk resmi anggota diperbarui + riwayat.
10. Cetak nota memakai tabel biaya sabuk bulat; **tanpa kode unik** (+1…999). Nomor nota memuat semester (`UKT/SBY/{RANTING}/I|II/{tahun}`). Pejabat (Bidang Ujian / Bendahara) dari **period-meta per periode**, fallback **Pengaturan → Kebijakan**.
10b. **Biaya sabuk & komisi** di-**snapshot** ke period-meta saat buat/simpan periode; UI Atur Biaya default menyimpan ke snapshot periode (`updateGlobal: false`). Template global (`RankFeeTemplate` + setting komisi) hanya diubah bila tanpa periode atau opsi “juga update global” dicentang.
10c. Wizard periode: jadwal buka/batas + **tanggal/jam & tempat ujian** + pejabat; langkah biaya mencatat bahwa nominal akan di-snapshot; buat periode mengirim `notifyRanting: true`.
11. Jadwal pendaftaran: **buka** default awal semester + **batas** default akhir semester; cabang atur di wizard (langkah 1) atau **Atur** setelahnya. Gate daftar: sekarang ∈ [buka, batas]. Kartu jadwal menampilkan juga **ujian + tempat** dan **pejabat** bila ada. Timer hitungan mundur (hari/jam/menit/detik/ms) tampil **besar** di ruang kosong kiri kartu aksi toolbar.
11b. **Rekonsiliasi setoran** (kartu di UI **cabang**): tabel Ranting / Peserta / Lunas / Total / Status setor via `buildUktDepositReconciliation`; status setoran (diterima/reset) **hanya diubah cabang** — `PATCH /api/admin/ukt/deposit` menolak non-cabang (`canEditKyuBaru`) fail-closed; ranting tidak lagi menandai setor dari halaman UKT (diganti alur nota + verifikasi cabang).
11c. **Cron H-3** (`/api/cron/ukt-reminders`, `vercel.json`): pengingat batas daftar & notifikasi jadwal ke ranting (idempoten lewat `notified*` di period-meta).
11e. **Kunci periode di API** (bukan cuma UI): `assertUktPeriodMutable` (`ukt-period-meta-store.ts`) dipanggil di `register`, `registrations/[id]` (PATCH/DELETE, resolve `eventId` dari registrasi), `deposit`, `fees` (bila `eventId`), `waiver`, `exam-day`, dan `validateUktRegistrationEligibility` — periode arsip/terkunci menolak mutasi di server meski request langsung ke API (anti-bypass tombol UI yang di-disable). `period-meta` PATCH (toggle arsip/kunci itu sendiri) sengaja **tidak** digate agar cabang tetap bisa membuka kunci.
11f. **Refresh tabel UKT read-only:** `fetchUktTableRefreshSnapshot` (dipakai `GET /api/admin/ukt/table`) hanya membaca & menggabungkan snapshot Inkai + fallback Prisma (allowlist ranting multi) — tidak melakukan tulis/side-effect apa pun saat memuat ulang tabel.
11g. **Hardening `registrations/[id]` (P0):** DELETE tidak lagi mempercayai `billingId` dari query klien (anti-IDOR) — hanya tagihan yang terverifikasi tertaut `registrationId` yang dihapus; mismatch dicatat `SECURITY_UKT_BILLING_ID_MISMATCH`. Scope ranting (`ADMIN_DOJO`) di `accept/reject_self_registration`, `submit_for_verification`, dan DELETE kini **fail-closed**: allowlist kosong atau dojo peserta tidak diketahui/tidak cocok → 403 (sebelumnya celah allowlist kosong = lolos). `deposit` PATCH kini **cabang-only** (`canEditKyuBaru`); jalur ranting `SUBMITTED` dihapus. Rate limit (`rateLimitAsync`/`rateLimitResponse`, ~20–30/60dtk per user) dipasang di `register`, `registrations/[id]` PATCH & DELETE, `deposit`, `fees`, `waiver`, `exam-day`, `period-meta`.
11d. **Fokus periode aktif:** resolusi mengutamakan non-arsip; judul kanonis `UKT Semester {I|II}-{tahun}`; buat periode baru mengarsipkan term yang sudah tutup; sidebar **UKT → Pendaftaran / Arsip UKT** (bukan dropdown campuran); anggota hanya melihat periode aktif. Arsipkan dari Pendaftaran mengarahkan ke Arsip; buka arsip mengembalikan ke Pendaftaran. **Arsip UKT** hanya menampilkan peserta yang sudah mendaftar (tanpa pool “Belum Daftar”).
12. Dashboard anggota: kartu **Status UKT** (daftar mandiri + konfirmasi bayar + status; **tanpa nominal**); admin cabang: export, Laporan WA, hari-H, setoran, arsip, waiver, wizard. Cabang & ranting dapat membatalkan pendaftaran UKT beserta tagihan terkait.
13. Toolbar cabang: **Buat Periode**, Hari-H, Export, Laporan WA, **Salin Undangan** / **WA Undangan**, Cetak Nota, Biaya Sabuk, Arsip (tombol terpisah). Toolbar ranting: **Laporan WA** + **Salin/WA Undangan** + **Cetak Nota** (manual).
14. **Undangan portal publik** `/undangan/ukt/[periodId]`: gaya undangan digital; snapshot `ukt-invite:{periodId}`; CTA **Daftarkan Anggota** → login admin.

### 9.4 Kegiatan & absensi
- **Cabang** dapat membuat event non-UKT di `/admin/kegiatan` (Gashuku, pertandingan, dll.).
- Anggota mendaftar event jika profil/dokumen/iuran memenuhi syarat.
- Anggota check-in di `/dashboard/absensi`: GPS otomatis ke dojo ber-geofence terdekat; override “Bukan di sini?”; QR opsional; biometrik HP (WebAuthn) opsional + GPS tetap wajib; maks **1×/hari** (Asia/Jakarta).
- % kehadiran semester = **hari unik** / 48; badge progres bertahap (MULAI LATIHAN … LAYAK UJIAN); min UKT 75%.
- Notifikasi inbox setelah check-in sukses (anggota + admin ranting dojo).
- Admin `/admin/absensi`: tabel Progress (klik → detail riwayat), Harian, Belum hadir; geofencing di Pengaturan.

### 9.5 Materi, store, pesan, pindah dojo, piagam
- **Materi Digital** — admin unggah/kelola; anggota membuka file.
- **Store** — admin kelola produk/stok; anggota pesan; admin konfirmasi status.
- **Pesan** — anggota chat pengurus; admin balas di `/admin/pesan`.
- **Pindah Dojo** — anggota ajukan → antrian verifikasi `DOJO_TRANSFER` → setuju memperbarui dojo.
- **Piagam** — anggota unggah di Prestasi → verifikasi `ACHIEVEMENT`.

### 9.6 Konten & organisasi
- Carousel beranda dikelola admin.
- Apresiasi (kenangan/prestasi) dikelola cabang di `/admin/apresiasi`; tampil di `/apresiasi` + cuplikan beranda.
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
| Portal publik | Lengkap | Konten organisasi, kegiatan terbuka (chip), apresiasi, carousel |
| Dashboard anggota inti | Lengkap | Beranda asisten: checklist, jadwal dojo, absen hari ini, PIC, aksi kontekstual; kegiatan via `/dashboard/kegiatan` |
| Admin anggota / iuran / UKT | Lengkap | Iuran: **rekening koran** per anggota + Sheet pengaturan/mutasi/bayar + pengecualian event/UKT; anggota: nonaktif/aktif/hapus arsip + **edit sabuk (cabang)**; UKT pakai gate iuran+dokumen+absensi, hasil ujian, rekap ranting, nota tanpa kode unik |
| Verifikasi kartu (publik) | Aktif | `/v/[id]` — scan QR kartu anggota |
| Event non-UKT | Aktif | Buat event di `/admin/kegiatan` (Cabang) |
| Materi / Store / Pesan / Pindah / Piagam | Aktif | Pesan: partisipan wajib (tanpa IDOR/fallback all); unread + cari + broadcast; store/materi upload |
| RBAC wilayah | Diterapkan | Matriks tampil di Pengaturan & Role; multi-akun per cabang/ranting + PIC; **preset permission** |
| Pengaturan wilayah | Lengkap | Multi-akun satu pintu, jabatan, PIC, serah terima; **email/password PIC** di form Ubah Data ranting (cabang); admin ranting ubah email/password di **Akun Saya** (email bisa diedit); geofence + **pratinjau peta OSM**; degradasi username login: klasifikasi pool vs error lain, KPI/filter aman saat DB gagal; **multi-ranting per akun** (`AppSetting` + context switcher); **promote akun existing ke admin cabang** (dual-role anggota + admin cabang) + badge tipe akun; arsip cabang **hapus permanen** (`permanent` pada DELETE cabang) |
| Lapor setor iuran (anggota) | Aktif | `/dashboard/iuran` + `PATCH /api/member/billing/[id]` (tgl + nominal = tagihan; tanpa bukti TF) |
| Scan/check-in absensi (anggota) | Aktif | `/dashboard/absensi` streaming + GPS multi-lokasi + biometrik + `/api/member/attendance/checkin` |
| Absensi admin | Aktif | Progress tabel+Sheet detail, harian, belum hadir; **DOM ≤ pageSize 25/50/100**; export CSV; tab client instan |
| Iuran generate bulan | Aktif | `POST /api/admin/billing/generate` (+ rate limit) + UI Iuran |
| Nav admin | Campuran | Top-level: Iuran, Event, Absensi; **UKT** sebagai grup (Pendaftaran + Arsip UKT); grup: Keanggotaan / Konten / Sistem + badge unread pesan |
| Deteksi duplikat anggota | Aktif | Keras: NIK / NIA / nama+TTL (termasuk arsip untuk NIK/NIA); lunak: nama; admin create melepas NIA/NIK arsip bila hanya bentrok nomor; blok create admin & daftar publik; UI peringatan |
| Gabungkan duplikat | Aktif | Ranting/cabang: pindahkan akun login + riwayat ke data operasional; arsipkan duplikat |
| Audit admin | Aktif | Filter + preset **Keamanan** (`SECURITY_*`/IMPERSONATE/upload/broadcast) + pagination client (25/50/100) + export CSV di `/admin/audit`; hapus jejak iuran lokal menolak `SECURITY_*` |
| Kehadiran akun | Aktif | `/admin/online` — pusat & cabang; heartbeat `/api/presence`; Redis opsional + DB fallback; jejak `UserSession`; **cabut sesi / kunci akun**; **impersonasi Mode A** (`inkai_impersonation` cookie) |
| Nominal UKT | Tanpa kode unik | Frontend tidak menulis `uniqueTail`; tampilan pakai `uktBaseFeeAmount` (+ strip data lama). Sinkron backend Inkai (opsional) |
| Unduh PDF UKT | Aktif | Tombol **Unduh PDF** di nota & export peserta (jspdf+html2canvas); Print tetap ada |
| Email notifikasi | Opsional (Resend) | `notifyUser` kirim email bila `RESEND_API_KEY`; dipakai pesan admin, verifikasi, UKT, lifecycle; reset-password email ke ranting |
| Eligibility UKT | Diterapkan | Gate periode tutup, iuran, dokumen, absensi semester minimum 75% |
| Hasil ujian UKT | Aktif | Cabang tetapkan `LULUS` / `GAGAL` / `MENGULANG`; Kyu Baru **wajib** setelah LULUS |
| Status UKT anggota | Aktif | `/api/member/ukt-status` + kartu: **Daftar UKT sekarang**, konfirmasi bayar, status Menunggu Terima/Verifikasi/Ujian; **tanpa nominal biaya** |
| Undangan portal UKT | Aktif | `/undangan/ukt/[periodId]` publik; snapshot `AppSetting` `ukt-invite:{id}`; Salin/WA Undangan di toolbar admin |
| Filter/KPI UKT operasional | Aktif | Status UI selaras: Belum Bayar, Menunggu Verif/Ujian, Lulus, Selesai; kartu KPI **Gagal/Mengulang** memfilter kedua status |
| Pengecualian UKT (waiver) | Aktif | Cabang kecualikan iuran/dokumen/absensi + catatan audit |
| Kebijakan syarat UKT | Aktif | `/admin/pengaturan/ukt` — centang iuran/dokumen/absensi + enforce ranting/cabang (`AppSetting` `ukt.registration.policy`) |
| Export rekap UKT | Aktif | Daftar peserta (formulir): Print/Save as PDF/CSV + pilih ranting + validasi + pratinjau |
| UKT hari-H | Aktif | Roster kehadiran di tempat + hasil massal LULUS/GAGAL/MENGULANG |
| Setoran UKT | Aktif | Status setor (SUBMITTED/RECEIVED) **hanya diubah cabang** (`canEditKyuBaru`, fail-closed); jalur ranting dihapus; **rekonsiliasi** peserta/lunas/tagihan vs status setor |
| Arsip periode UKT | Aktif | Kunci periode (blok daftar/ubah); export tetap |
| Snapshot biaya UKT | Aktif | `beltFees` + `komisiRanting` di period-meta; Atur Biaya default period-only; global opsional |
| Jadwal ujian UKT | Aktif | `examAt` + `examLocation` di period-meta; wizard + kartu jadwal + kartu anggota |
| Pejabat UKT per periode | Aktif | `bidangUjianName` / `bendaharaCabangName` di meta; fallback kebijakan cabang; dipakai nota |
| Notifikasi ranting UKT | Aktif | `notifyRanting` saat buat/ubah periode; cron H-3 `/api/cron/ukt-reminders` |
| Notifikasi UKT | Aktif | Otomatis ke anggota saat daftar, verifikasi bayar, hasil ujian, selesai |
| Ketergantungan API | Ada | Halaman degrade jika API sibuk/timeout |
| Email & Blob | Opsional | Perlu env production |
| Keamanan P0–P2 | Diperkuat | Pesan IDOR ditutup; verifikasi fail-closed + **assertDojoInScope destinasi transfer**; rate limit Upstash opsional (broadcast/bulk/upload/normalize/**billing/generate**/presence lock-revoke); CSRF admin ketat; password register; audit upload/broadcast/verifikasi; **forbidUnlessAdminPath** carousel/store/materi; document proxy tanpa blanket `*.vercel.app`; security-events (`SECURITY_*` / abuse burst) |
| Keamanan P1 (ops wiring) | Selesai | `rateLimitResponse(retryAfterSec, key)` fire-and-forget `SECURITY_RATE_LIMIT`+strike bump saat trip (billing/generate, broadcast, members/bulk, upload, normalize, presence lock/revoke); `SECURITY_SCOPE_DENIED` di setiap deny 404/403 out-of-scope (`members/[id]` semua aksi, `billing/[id]` PATCH/DELETE) tanpa bocorkan data; upload admin **magic-byte sniff** (jpeg/png/webp/gif/pdf) menolak mismatch MIME vs header; `check-duplicate` disaring ulang oleh `buildMemberFilter` (anti-IDOR lintas wilayah); prisma-error mentah di billing/generate tidak lagi diteruskan ke klien |
| Keamanan P2 (UKT scope) | Selesai | `billing/[id]` DELETE **fail-closed**: tanpa baris `Billing` lokal cocok (`buildMemberFilter`) → deny 403/404, tidak menebak lewat Inkai; `GET /api/admin/ukt/members?memberId=` verifikasi `buildMemberFilter` dulu (403 bila di luar cakupan / ADMIN_DOJO tanpa ranting) sebelum fetch Inkai, pesan error digeneralisasi (tanpa echo raw Inkai); `GET /api/admin/ukt/suggest` `q` dibatasi 64 char (zod), ADMIN_DOJO wajib allowlist non-kosong + `dojo` param harus masuk allowlist, pencarian di-scope lewat Prisma (`dojoId in allowlist`) bukan Inkai global |
| Keamanan P0 (UKT write-path) | Selesai | `assertUktPeriodMutable` menolak mutasi saat periode arsip/kunci (`register`, `registrations/[id]` PATCH/DELETE, `deposit`, `fees`, `waiver`, `exam-day`, `validateUktRegistrationEligibility`); `registrations/[id]` DELETE tidak lagi percaya `billingId` klien (anti-IDOR, hanya tagihan tertaut `registrationId`, mismatch → `SECURITY_UKT_BILLING_ID_MISMATCH`); scope `ADMIN_DOJO` (accept/reject self-registration, submit verifikasi, DELETE) **fail-closed** (allowlist kosong / dojo tak diketahui → 403, bukan lolos); `deposit` PATCH cabang-only; rate limit `register`/`registrations/[id]`/`deposit`/`fees`/`waiver`/`exam-day`/`period-meta` (~20–30/60dtk/user) |
| Performa admin | Diperkuat | Badge pesan di-cache 45s; KPI/pageSize; **navigasi instan**; **dashboard anggota: slim critical path (tanpa agenda), sticky header, cache token, Suspense UKT**; index Billing/Event/EventRegistration/Appreciation/AuditLog; **iuran ledger**: query billing tersegmentasi (belum-lunas + periode-only, bukan dump seluruh riwayat), KPI dari hasil query tersebut; **UKT**: `UktDashboard` via `next/dynamic`; loader tanpa soft PUT on load; **arsip slim** (tanpa dump anggota/billing/attendance); **registrasi-first merge** anti trap 500; anti-freeze per-baris; **iuran page**: Suspense bersarang |
| Anti-freeze UI UKT | Diperkuat | `UktDashboard`: `loading` global hanya dipakai aksi lingkup periode (buat periode, jadwal, biaya sabuk, arsip, exam-day/Bayar UKT massal); aksi per-baris (daftar, Kyu, hasil ujian, batal, hapus tagihan, terima/tolak mandiri, mark paid) murni pakai `pendingMemberIds`/`isMemberPending` — tidak lagi jatuh ke `setLoading` sehingga 1 baris sibuk tidak mengunci toolbar/baris lain; **SLA**: `ukt/table` `maxDuration=15`, `ukt/register` `maxDuration=30` — batas ini yang membatasi durasi spinner per-baris, bukan lock toolbar global |

| Index Prisma | Ditambah | Member/Billing/Attendance/Verification/Message + Billing(registrationId, memberId+isDeleted+type) / Event(isDeleted+endDate|registrationCloseAt) / EventRegistration(eventId+status) / AppreciationEntry / AuditLog(action+createdAt) — migrate `20260724120000_admin_perf_security_indexes` |
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
/api/presence               POST heartbeat kehadiran; DELETE clear (logout/ganti akun)
/api/admin/presence         GET daftar sedang aktif / login 24 jam (pusat & cabang, scoped)
/api/admin/presence/revoke  POST cabut sesi user (pusat/cabang, scoped) + audit SECURITY_SESSION_REVOKE
/api/admin/presence/lock    POST kunci akun (isActive=false) + cabut sesi + audit SECURITY_SESSION_LOCK
/api/admin/presence/unlock  POST buka kunci akun + audit SECURITY_SESSION_UNLOCK
/api/admin/impersonate/start POST ambil alih (step-up password + frasa AMBIL ALIH); cookie inkai_impersonation
/api/admin/impersonate/stop  POST hentikan ambil alih; hapus cookie
/api/admin/members          POST create; GET list+KPI counts (filter cepat client-side)
/api/admin/members/bulk-create  Input massal tambah anggota (maks 50)
/api/admin/members/[id]     Detail + aksi (approve/NIA/set_name/set_msh/set_rank/set_dojo/set_dues/set_dues_exemption/dokumen/reset_password/nonaktif/hapus/restore/merge)
/api/admin/members/bulk     Bulk nonaktif / approve / hapus-arsip (ARSIPKAN) / purge arsip (HAPUS) / restore
/api/admin/members/archived Daftar arsip soft-delete
/api/admin/billing/[id]     Edit tagihan, **submit_for_verification** (ranting→Menunggu Verifikasi), verifikasi/tandai lunas, **hapus** (ranting/cabang; force lunas = cabang; fallback Prisma bila API gagal)
/api/admin/billing/generate Buat tagihan iuran bulanan massal
/api/admin/billing/bulk-mark-paid  Lunas tunai massal per periode (memberIds + year/month)
/api/admin/iuran/members/[id]  Detail rekening iuran anggota (profil + mutasi bulanan + summary tunggakan + jejak aksi; scoped RBAC)
/api/admin/iuran/members/[id]/report-setor  Ranting/cabang catat setor periode (selaras lapor anggota)
/api/admin/iuran/audit/[id]    DELETE jejak aksi lokal rekening iuran (ranting/cabang, scoped member)
/api/admin/ukt/registrations/[id]  Update/hapus pendaftaran UKT (`submit_for_verification` / `mark_paid` / Kyu; cabang force hapus: API lalu fallback Prisma shared DB); kunci periode (`assertUktPeriodMutable`) di PATCH & DELETE
/api/admin/ukt/table        Refresh cepat tabel UKT (snapshot registrasi/tagihan periode, merge ke rows lokal); read-only, tanpa side-effect write; `maxDuration=15`
/api/admin/ukt/members      GET detail 1 anggota untuk riwayat UKT — scoped `buildMemberFilter`/allowlist ranting sebelum fetch Inkai (403 di luar cakupan)
/api/admin/ukt/suggest      GET autocomplete nama/NIA (q≥2, maks 64 char); ADMIN_DOJO di-scope Prisma ke ranting allowlist, role lain via Inkai `/v1/members`
/api/admin/ukt/deposit      PATCH status setoran ranting — **cabang-only** (`canEditKyuBaru`); kunci periode berlaku
/api/admin/ukt/register     POST daftar anggota ke periode UKT; kunci periode berlaku; `maxDuration=30`
/api/admin/ukt/*            Periode, waiver, nota, hasil ujian, fees (snapshot/global; kunci periode berlaku), Kyu, exam-day, period-meta, invite (siapkan snapshot), hapus pendaftaran + tagihan terkait; sync undangan publik `ukt-invite:{id}`
/api/cron/ukt-reminders     Cron H-3 pengingat UKT (batas daftar / jadwal ranting)
/api/admin/open-events       Daftar kegiatan dengan pendaftaran masih terbuka (topbar admin)
/api/admin/account-peers   Email akun ranting gabungan (overlap managed dojos) untuk topbar ganti akun
/api/admin/pengaturan/*     User, cabang, ranting, wilayah-accounts, roles, geofencing, akun, kebijakan (pejabat dokumen), **ukt** (syarat daftar)
/api/admin/verifications/*  Proses klaim
/api/admin/carousel/*       Carousel beranda (Prisma lokal)
/api/admin/apresiasi/*      CRUD apresiasi publik (cabang)
/api/admin/upload           Upload ke Blob
/api/admin/document-file    Proxy pratinjau dokumen anggota (modal + print)
/api/admin/events           Buat event non-UKT (Cabang)
/api/admin/events/[id]      Detail/roster + ubah/tutup event
/api/member/profile          GET sabuk kartu (no-store) + PATCH profil lengkap (identitas, foto, dokumen; email/NIA/sabuk/MSH 1×)
/api/member/profile-change   Pengajuan ubah email/NIA/sabuk/MSH setelah terkunci (`PROFILE_CHANGE`)
/api/member/upload           Unggah file anggota (foto/akte/bpjs + folder legacy iuran/piagam)
/api/member/document-file    Proxy pratinjau dokumen anggota
/api/member/ukt-status       Kartu status UKT periode aktif untuk anggota
/api/member/ukt/register     Daftar UKT mandiri (PENDING, tanpa billing)
/api/member/ukt/confirm-payment  Flag konfirmasi sudah bayar ke ranting
/api/admin/ukt/registrations/[id]  … + `accept_self_registration` / `reject_self_registration`
/api/admin/materi/*         CRUD materi digital
/api/admin/store/*          Produk & status pesanan
/api/admin/pesan/*          Inbox, unread, tandai dibaca, balas
/api/admin/broadcast        Broadcast notifikasi ke anggota (scope)
/api/member/materi          Daftar materi
/api/member/store           Katalog & pesan produk
/api/member/pesan           Chat pengurus (tandai dibaca + unread)
/api/member/pindah          Ajuan pindah dojo
/api/member/piagam          Unggah piagam
/api/member/billing/[id]    Lapor setor iuran (paidAt + amount; ownership check; Prisma + Inkai)
/api/member/billing/report-period  Lapor setor per periode YYYY-MM (bulan berjalan/sebelumnya; buat tagihan bila perlu)
/api/member/attendance/checkin  Check-in absensi GPS (+ resolve geofence, 1×/hari, notif)
/api/member/attendance/locations  Daftar dojo/event override (tanpa koordinat)
/api/member/attendance/webauthn/*  Register/verify biometrik absensi (WebAuthn)
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
| 22 Juli 2026 | **Kehadiran akun**: `/admin/online` untuk pusat & cabang; heartbeat + `lastLoginAt`/`lastSeenAt`; Redis opsional; clear saat logout; catatan privasi di profil/akun; tanpa force-logout |
| 22 Juli 2026 | Kehadiran audit: tabel `UserSession` (IP, UA, browser/OS, lokasi CDN, timezone/layar); detail UI + export CSV; bootstrap sesi dari heartbeat |
| 22 Juli 2026 | Fix WA PIC beranda anggota: multi-nomor di `Dojo.phoneNumber` (mis. `0852…/0896…`) tidak lagi di-concat; pakai nomor utama + bersihkan data JWON |
| 22 Juli 2026 | Fix sabuk kartu anggota: `resolveMemberDisplayRank` mengikuti `currentRank` keanggotaan (selaras admin/verifikasi QR), bukan sabuk tertinggi dari riwayat/UKT |
| 22 Juli 2026 | Detail anggota: centang **pengecualian iuran** (`allowEventWithoutDues`) — gate daftar event/UKT tanpa lunas iuran; generate tagihan bulanan skip anggota pengecualian |
| 22 Juli 2026 | Pengaturan ranting (cabang): **Jadikan admin ranting** — email login existing (anggota) jadi `ADMIN_DOJO` dual-role tanpa akun baru (`promote_existing`) |
| 22 Juli 2026 | Portal dual-role: login default `/dashboard` bila `memberId` + admin; admin-only tetap `/admin`; **Panel Admin** hanya tampil bila email punya role admin (`canChooseAdminPortal`) |
| 22 Juli 2026 | **Jadikan admin ranting**: centang hak akses per akun — edit profil, CRUD anggota, menu sidebar admin (`adminGrants` di meta ranting); tombol perbarui hak akses di daftar akun |
| 22 Juli 2026 | Form Tambah Ranting: penanda field wajib (*); perbaiki kirim `adminEmail` ke Inkai saat buat/ubah (password tetap Prisma); validasi email+password berpasangan |
| 22 Juli 2026 | Topbar akun gabungan: hanya tampilkan email yang berbagi kelola ranting (API `/account-peers`), bukan riwayat Ganti Akun dari localStorage |
| 22 Juli 2026 | Pengaturan Ranting & User: UI diperjelas sebagai panel **akun admin ranting**; akun dual-role ditandai **Admin + Anggota**, anggota biasa tidak tampil sampai dijadikan admin ranting |
| 22 Juli 2026 | Pengaturan Cabang: tambah alur **Jadikan admin cabang** untuk akun existing (contoh ketua cabang) tanpa akun baru; panel Akun Admin membedakan **Admin + Anggota** vs **Admin saja** |
| 22 Juli 2026 | Hotfix build Vercel: `wilayah-accounts` — `memberId` via relasi Prisma `member`; hapus `adminGrantsRaw` dari response PATCH tanpa `delete` pada field wajib |
| 22 Juli 2026 | Perbaikan cabang: fallback PIC & `isHomeDojo` scope-aware di `listWilayahAccounts`; audit promote cabang `WILAYAH_ACCOUNT_PROMOTE_ADMIN_BRANCH`; copy UI tanpa contoh email spesifik |
| 22 Juli 2026 | Dashboard dual-role: **ikon Panel Admin** (perisai) di header kanan sebelah logout + sub-halaman anggota; refresh klaim JWT dari DB (~30s) setelah promosi admin cabang/ranting |
| 23 Juli 2026 | UKT admin mobile: hapus timer ms + rAF (tick 1s, pause tab hidden); sticky hanya semester; grid aksi/filter; jadwal & alur collapsible; hapus tombol Back redundant |
| 23 Juli 2026 | Admin mobile global: topbar lebih pendek + Menu ikon; shell `overflow-x-hidden`; `AdminPageHeader` di semua halaman; filter Anggota/Settings/Iuran/Absensi/Online; KPI scroll; bulk-bar safe-area; IuranOps collapsible |
| 23 Juli 2026 | Admin aksi baris mobile: `AdminMoreActions` (user/ranting/cabang/event/store/materi/carousel/UKT); Verifikasi/Iuran tombol full-width; tabel Anggota/UKT sembunyikan Foto/Sabuk/Terdaftar di HP |
| 23 Juli 2026 | Pesan admin mobile: inbox/thread single-pane (kembali ←); broadcast stack; safe-area composer |
| 23 Juli 2026 | Polish visual admin: atmosfer `admin-surface`, topbar aksen merah–kuning, header dengan strip, sidebar/nav lebih halus, kartu/tabel lembut |
| 23 Juli 2026 | Polish visual publik: `public-surface`, topbar/nav/footer elegan, hero grid lebih lembut, CTA & kartu beranda dirapikan |
| 23 Juli 2026 | Halaman konten publik: header Badge+h1 diganti `PublicPageHeader` (sejarah, makna-lambang, visi-misi, kontak, berita, kegiatan, dojo, struktur, keamanan-siber) |
| 23 Juli 2026 | Tema: default ikuti sistem OS; tombol siklus sistem → terang → gelap (ikon Monitor/Moon/Sun); `storageKey=inkai-theme` |
| 23 Juli 2026 | Navigasi cepat: hapus min delay 180ms + overlay loader; matikan animasi content-enter; hapus `loading.tsx` admin/dashboard/publik agar konten lama tetap sampai halaman baru siap |
| 23 Juli 2026 | Toast loading elegan: spinner Sonner diganti `InkaiLogoLoader` (logo + ring beranimasi) di Toaster global |
| 23 Juli 2026 | UKT timer: milidetik dikembalikan (hari–jam–menit–detik–ms via rAF); tetap pause saat tab tersembunyi |
| 23 Juli 2026 | Profil anggota: tampil + edit foto, NIK, JK, TTL, alamat, telepon, Akte/BPJS; email/sabuk baca saja; API PATCH sync Inkai+Prisma |
| 23 Juli 2026 | Profil: email/NIA/sabuk/MSH edit mandiri 1× lalu pengajuan `PROFILE_CHANGE`; kolom `mshNumber` + migrasi; Kartu Anggota tampilkan NIA + No. MSH (Hitam/DAN) |
| 23 Juli 2026 | Perf dashboard anggota: parallel fetch beranda; Suspense UKT; tanpa poll kartu/fade; SSR pesan/store; cache profil; heartbeat 90s |
| 23 Juli 2026 | Tema default: **jam operasional** (05–17 terang, 18–04 gelap) menggantikan ikuti OS; siklus jadwal → terang → gelap; ikon Clock |
| 23 Juli 2026 | No. MSH di Kelola Anggota (kolom + detail edit `set_msh`); notifikasi admin ranting/cabang saat MSH diisi/diubah (profil, pengajuan, admin) |
| 23 Juli 2026 | Kelola Anggota: ranting/cabang edit **Nama** inline (`set_name`) + **Dokumen** (tombol Ubah di kolom) |
| 23 Juli 2026 | Admin Iuran → **rekening koran**: tabel anggota (Iuran/bln, status bulan, tunggakan, aging, **Pengecualian** event/UKT); Sheet Pengaturan/Mutasi/Pembayaran; strip verifikasi; `GET /api/admin/iuran/members/[id]`; deep-link dari detail anggota |
| 23 Juli 2026 | Iuran MVP gaps: filter tipe bulanan saja; aging + status Belum digenerate; **jejak aksi** lokal di Sheet; **bulk lunas tunai** `POST /api/admin/billing/bulk-mark-paid` |
| 23 Juli 2026 | Admin topbar: chip **Masih terbuka** (pulse live, shimmer, rotasi judul, panel daftar + sisa waktu); `GET /api/admin/open-events` |
| 23 Juli 2026 | Topbar kegiatan terbuka: HP = ikon compact di cluster aksi (judul tidak terpotong); panel fixed + backdrop |
| 23 Juli 2026 | Transisi logo INKAI elegan (login/logout/ganti akun + perpindahan portal publik↔admin↔dashboard): overlay ringan tanpa blur, unmount saat idle, progress tipis untuk nav dalam shell; `NavigationProvider` global; hapus delay 750ms ganti akun |
| 23 Juli 2026 | Perf auth+UI paket: login 1× Inkai (tanpa `/validate` ganda) + kode error CredentialsSignin; logout/ganti akun tanpa double clearPresence; topbar foto+nama; notif `countOnly` poll 180s; OpenEvents tanpa shimmer/pulse infinite; topbar blur hanya desktop; UKT ms via DOM ref |
| 23 Juli 2026 | **Undangan portal UKT**: `/undangan/ukt/[periodId]` (cover+musik+Home/Acara/Galeri/Peta auto/klik/scroll), snapshot `ukt-invite`, Salin/WA Undangan di toolbar, login `callbackUrl` ke `/admin/ukt` |
| 23 Juli 2026 | Undangan UKT: ringanin UI — hapus animasi infinite/blur/noise, tunda mount konten+Maps, countdown via DOM ref, musik HTMLAudio saja, font `next/font` |
| 23 Juli 2026 | Fix 404 undangan: fallback service token + persist snapshot; `POST /api/admin/ukt/invite` saat Salin/WA Undangan |
| 24 Juli 2026 | **UKT daftar mandiri:** anggota Daftar UKT sekarang + gate syarat + konfirmasi bayar; ranting Terima/Tolak → cabang Verifikasi; anti-bocor nominal di iuran anggota; unique `(eventId,memberId)`; API `POST /api/member/ukt/register` + `confirm-payment` |
| 24 Juli 2026 | Perf kartu UKT anggota: parallel fetch; Prisma-first (tanpa dump registrasi Inkai); gate eligibility ditunda ke klik daftar; optimistic UI tanpa refetch ganda |
| 24 Juli 2026 | **Iuran setor ranting:** anggota lapor tanggal bayar (nominal = tagihan, tanpa unggah bukti); ranting konfirmasi di Sheet/antrian; preserve `paidAt`; Mutasi/Pembayaran tampil tgl setor |
| 24 Juli 2026 | Iuran Sheet: ranting/cabang **hapus jejak aksi** lokal (`DELETE /api/admin/iuran/audit/[id]`) + toast loading logo INKAI pada aksi verifikasi/hapus |
| 24 Juli 2026 | Iuran anggota: lapor setor **periode sebelumnya** (`POST /api/member/billing/report-period`, maks 24 bln) + toast loading logo INKAI |
| 24 Juli 2026 | Ranting **catat setor periode** di Sheet Iuran (`POST …/report-setor`, helper `iuran-setor-period`); mutasi+jejak; status menunggu Setujui |
| 24 Juli 2026 | Beranda anggota: hapus section Agenda (bug undefined); slim critical fetch; sticky header; cache token + overlay profil paralel |
| 24 Juli 2026 | Tambah Anggota: field **No. MSH** opsional (Sabuk); persist Prisma + unique/Hitam-DAN + notif admin |
| 24 Juli 2026 | Absensi: streaming UI anggota; GPS multi-lokasi + geofence server; biometrik WebAuthn; 1×/hari + % hari unik; label progres; admin tabel Progress+Sheet; notif check-in; soft-backfill menu Absensi ranting |
| 24 Juli 2026 | Absensi admin: tab Progress/Harian/Belum **client-side instan** (tanpa RSC reload); payload log dibatasi; peek biometrik ringan |
| 24 Juli 2026 | **Tutorial:** skrip video anggota+pengurus (`guide/tutorials/`); `/tutorial` publik (tab nav) + `/dashboard/panduan` langkah+embed YouTube; welcome v2 |
| 24 Juli 2026 | Beranda publik: floating chip **Masih terbuka**; hapus `/berita` (redirect `/`); modul **Apresiasi** (Kenangan/Prestasi) + admin CRUD + cuplikan beranda; badge kegiatan; `loading.tsx` publik |
| 24 Juli 2026 | Form daftar `/login?tab=daftar` selaras Tambah Anggota: urutan Dojo→Identitas→Sabuk→Akun; No. MSH di Sabuk (hanya Hitam/DAN); persist Prisma + notif admin; tutorial urutan diperbarui |
| 24 Juli 2026 | Security hardening: index Prisma admin-perf; bulk memberIds `.max(100)`; `forbidUnlessAdminPath` carousel/store/materi; rate limit broadcast/bulk/upload/normalize; `security-events`; sempitkan document URL allowlist; assertDojoInScope destinasi verifikasi transfer |
| 24 Juli 2026 | **Security ops:** cabut sesi / kunci / buka kunci (`session-control` + JWT block); impersonasi Mode A (cookie `inkai_impersonation` jose); banner + blok password/email; audit `SECURITY_*` |
| 24 Juli 2026 | **Security ops P1 wiring:** rate limit `billing/generate` (5/60dtk); `rateLimitResponse` fire-and-forget `SECURITY_RATE_LIMIT`+strike bump di semua endpoint rate-limited; `SECURITY_SCOPE_DENIED` di deny out-of-scope `members/[id]` & `billing/[id]`; upload admin magic-byte sniff (tolak MIME palsu); `check-duplicate` disaring `buildMemberFilter` (anti-IDOR wilayah); hapus echo pesan error Prisma mentah di billing/generate & upload |
| 24 Juli 2026 | **Impersonasi Mode A — UX & anti-fake-data:** TTL dipersingkat 60→**15 menit**; modal risiko `ImpersonationRiskModal` (9 poin risiko + checklist ack + alasan + password step-up + frasa **AMBIL ALIH**) gantikan `window.prompt` bertingkat di `/admin/online`; token Inkai saat ambil alih **tetap milik aktor** — semua fetcher `/me`+`/my` di `member-data.ts` (`fetchMyMemberProfile`/`fetchMyBillings`/`fetchMyAttendance`/`fetchMyEventRegistrations`/`fetchMyNotifications`) diblok saat mode ambil alih (kembalikan null/[] alih-alih data aktor); halaman `dashboard` (beranda, profil, dokumen, prestasi, pindah, detail kegiatan) tampilkan notice jujur **"Tidak tersedia saat ambil alih"** alih-alih data yang salah/tertukar |
| 24 Juli 2026 | **Admin perf lanjutan:** `/admin/audit` preset **Keamanan** (`SECURITY_*`/IMPERSONATE/upload/broadcast) + pagination client 25/50/100 (data Inkai API hard-cap, fetch 300 lalu filter/paginate client); konfirmasi hapus jejak audit lokal sudah menolak `SECURITY_*` (tanpa perubahan, hanya diverifikasi); `iuran-ledger.ts` — query billing tersegmentasi (findMany belum-lunas lintas periode + findMany match periode aktif saja) menggantikan dump seluruh riwayat billing per anggota, KPI dihitung dari dua hasil query tsb (bukan reduce atas seluruh histori); `/admin/ukt` & `/admin/ukt/arsip` — `UktDashboard` (~180KB client component) dibungkus `next/dynamic`; `/admin/iuran` — Suspense bersarang: header+form filter render instan, KPI+OpsBar+tabel dipindah ke `IuranLedgerSection` async terpisah (urutan visual: form filter kini di atas KPI) |
| 24 Juli 2026 | **Paket ahli Admin Perf+Security (selesai):** P0 IDOR fail-closed `members/[id]`+`billing/[id]`; CSRF proxy → `SECURITY_CSRF_REJECT`+strike; Absensi admin pager DOM; Anggota debounce search 300ms; apresiasi/store/materi `take:200`; Zod `ukt/invite`; inventaris §6/§10/§11/§13/§15 diselaraskan |
| 24 Juli 2026 | Carousel beranda: CRUD + baca publik pakai **Prisma lokal** (bukan Inkai `/v1/news-carousel`) agar admin cabang tidak kena *Access denied: Insufficient permissions* |
| 24 Juli 2026 | Upload admin/anggota: fallback **Supabase Storage** (`portal-public`) bila `BLOB_READ_WRITE_TOKEN` belum ada — pakai `SUPABASE_SECRET_KEY` yang sudah di Vercel |
| 24 Juli 2026 | **UKT scope + anti-freeze:** `ukt/members` GET fail-closed (`buildMemberFilter`/allowlist ranting, tanpa echo error mentah); `ukt/suggest` GET `q` maks 64 char (zod) + ADMIN_DOJO wajib allowlist non-kosong & pencarian di-scope Prisma ke ranting; copy kartu setoran diluruskan **cabang-only** (selaras `deposit` API yang memang sudah `canEditKyuBaru`); `UktDashboard` — aksi per-baris (`handleExamResult`/`handleCancelRegistration`) berhenti fallback ke `setLoading` global, murni `pendingMemberIds` agar 1 baris sibuk tidak mengunci toolbar; dicatat juga kunci periode API (`assertUktPeriodMutable` di register/registrations/deposit/fees), refresh tabel read-only tanpa side-effect, dan merge anggota registrasi-first; inventaris §9.1/§9.3/§11/§13/§15 diselaraskan |
| 24 Juli 2026 | **UKT P0 security+rate limit:** `assertUktPeriodMutable` (arsip/kunci gate, `ukt-period-meta-store.ts`) diwire ke `register`/`registrations/[id]` PATCH+DELETE/`deposit`/`fees`/`waiver`/`exam-day`/`validateUktRegistrationEligibility`; `registrations/[id]` DELETE anti-IDOR (billingId dari klien tak lagi dipercaya, hanya tagihan terverifikasi tertaut registrasi yang dihapus) + log `SECURITY_UKT_BILLING_ID_MISMATCH` saat mismatch; scope `ADMIN_DOJO` fail-closed (allowlist kosong / dojo peserta tak diketahui-cocok → 403, bukan lolos) di accept/reject self-registration, submit verifikasi, DELETE; `deposit` PATCH jadi cabang-only murni (jalur ranting `SUBMITTED` dihapus); rate limit (`rateLimitAsync`/`rateLimitResponse`, ~20–30/60dtk/user) di 7 endpoint tulis UKT termasuk `period-meta` |
| 24 Juli 2026 | **UKT loader SLA:** hapus soft PUT `registrationOpenAt` pada load dashboard (hanya backfill in-memory); mode arsip skip pool anggota/billing/verifikasi/attendance dump; merge registrasi-first Prisma untuk peserta di luar cap 500; attendance dihitung setelah members final (filter ID relevan); inventaris §9/§11/§15 |

---

*Dokumen ini living inventaris organisasi (bukan laporan sekali-jadi) dan dapat dilampirkan pada presentasi pengurus Cabang / Pengprov.*
