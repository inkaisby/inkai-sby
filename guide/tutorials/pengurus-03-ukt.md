# Pengurus 03 — UKT ranting & cabang

## Tujuan
Ranting mendaftarkan / menerima daftar mandiri / mengajukan bayar; cabang memverifikasi.

## Akun demo
Satu akun ranting + (ideal) satu akun cabang; periode UKT aktif.

## Storyboard
### Bagian ranting
1. `/admin/ukt` → periode aktif.
2. **Daftar UKT** anggota → status Belum Bayar.
3. Atau anggota mandiri: aksi **Terima** / **Tolak** (Terima = uang sah → Menunggu Verifikasi).
4. Jalur daftar ranting: **Bayar UKT** → Menunggu Verifikasi.
5. Singgung **Batal UKT**, Laporan WA / Cetak Nota (sekilas).

### Bagian cabang
6. Filter **Menunggu Verif.** → **Verifikasi** → Menunggu Ujian.
7. Setelah ujian: isi Kyu Baru / hasil (singkat).

## Narasi VO
"Ranting bisa mendaftarkan anggota langsung, atau menerima daftar mandiri setelah uang diterima — tombol Terima. Bayar UKT dari ranting mengajukan ke cabang. Cabang yang memverifikasi pembayaran hingga status menunggu ujian. Label Terima untuk ranting, Verifikasi untuk cabang."

## Teks on-screen
- Daftar UKT / Terima / Tolak / Bayar UKT
- Verifikasi (cabang)
- Menunggu Ujian

## Checklist rekaman
- [ ] Aksi ranting jelas
- [ ] Aksi cabang Verifikasi
- [ ] Status berubah di UI

## Jangan tampilkan
Kebocoran proses ke layar anggota dengan nominal; password pejabat; data rekening sensitif.
