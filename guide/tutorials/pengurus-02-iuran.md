# Pengurus 02 — Verifikasi iuran

## Tujuan
Pengurus memverifikasi laporan setor anggota dan mengatur pengecualian iuran bila perlu.

## Akun demo
Admin ranting/cabang; ada laporan setor `WAITING_VERIFICATION`.

## Storyboard
1. Buka `/admin/iuran`.
2. Tunjukkan strip **Perlu aksi — menunggu verifikasi** → **Setujui**.
3. Atau klik nama anggota → Sheet **Pembayaran** → **Setujui setor** / **Tolak setor**.
4. Tab **Pengaturan**: Iuran/bln + toggle **Pengecualian iuran** (untuk event/UKT).
5. Singgung tab **Mutasi** / Catat setor periode (opsional singkat).

## Narasi VO
"Di menu Iuran, laporan setor anggota masuk antrian verifikasi. Setujui jika uang sudah diterima, atau tolak jika belum. Pengecualian iuran dipakai jika anggota diizinkan ikut event atau UKT tanpa wajib lunas — wewenang ranting."

## Teks on-screen
- Menunggu verifikasi
- Setujui setor / Tolak
- Pengecualian iuran

## Checklist rekaman
- [ ] Antrian atau Sheet pembayaran
- [ ] Setujui berhasil
- [ ] Pengecualian (opsional)

## Jangan tampilkan
Rekening koran lengkap banyak anggota dengan data sensitif; fokus satu kasus demo.
