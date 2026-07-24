# Pengurus 01 — Verifikasi & kelola anggota

## Tujuan
Pengurus ranting/cabang menyetujui pendaftar mandiri, menambah anggota, dan menggabungkan duplikat.

## Akun demo
`ADMIN_DOJO` atau `ADMIN_BRANCH`; siapkan 1 anggota status Menunggu (PENDING).

## Storyboard
1. Login → buka **Panel Admin** jika dual-role → `/admin`.
2. Buka **Kelola Anggota** → filter / KPI **Menunggu**.
3. Buka detail → **Setujui** (atau bulk Setujui pending).
4. Demo **Tambah Anggota** (satu orang).
5. Singgung **Input Massal** (opsional, singkat).
6. Jika ada duplikat: banner → **Gabungkan**.

## Narasi VO
"Pendaftar mandiri muncul dengan status Menunggu. Buka Kelola Anggota, periksa data, lalu Setujui agar anggota bisa login. Anda juga bisa menambah anggota manual atau menggabungkan data duplikat jika ranting sudah mendaftarkan lebih dulu."

## Teks on-screen
- Menunggu verifikasi
- Setujui / Tolak
- Tambah Anggota
- Gabungkan

## Checklist rekaman
- [ ] List pending
- [ ] Aksi Setujui
- [ ] Tambah atau merge singkat

## Jangan tampilkan
Password sementara di layar terlalu lama; NIK anggota nyata tanpa blur.
