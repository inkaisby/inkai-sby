/** Ringkasan konten halaman organisasi publik untuk Tanya INKAI (bukan scrape HTML). */

export function buildOrgKnowledgeBlock(): string {
  return `
## Sejarah INKAI (halaman /sejarah)
Institut Karate-Do Indonesia (INKAI) adalah organisasi karate nasional yang berdiri dengan tujuan mengembangkan dan melestarikan seni bela diri karate di seluruh Indonesia.

Awal mula: INKAI didirikan oleh para pendekar karate Indonesia yang berkomitmen membawa karate-do ke masyarakat luas dengan pendekatan sistematis dan terstruktur, mengadopsi kurikulum karate tradisional yang disesuaikan dengan karakter bangsa Indonesia.

INKAI di Surabaya: Cabang Surabaya adalah salah satu cabang aktif di Jawa Timur dengan puluhan dojo/ranting di kota Surabaya. Sejak berdirinya, INKAI Surabaya telah melahirkan banyak karateka berprestasi di tingkat regional maupun nasional.

Perkembangan: Organisasi hierarkis Pusat (Nasional) → Provinsi → Cabang → Dojo/Ranting → Anggota.

## Visi & Misi (halaman /visi-misi)
Visi: Menjadi organisasi karate-do terdepan di Indonesia yang melahirkan karateka berintegritas, tangguh, rendah hati, dan berprestasi di tingkat nasional maupun internasional.

Misi:
1. Mengembangkan dan melestarikan seni bela diri karate-do di seluruh Indonesia.
2. Membentuk karateka yang disiplin, berakhlak mulia, dan siap berkompetisi.
3. Menyelenggarakan pelatihan, ujian kenaikan sabuk, dan kompetisi berkala.
4. Membangun jaringan organisasi yang terstruktur dari pusat hingga dojo/ranting.
5. Mengintegrasikan nilai-nilai budo karate dalam kehidupan sehari-hari anggota.

Nilai inti: Integritas, Tangguh, Rendah Hati.

## Makna Lambang (halaman /makna-lambang)
Setiap elemen lambang memiliki makna filosofis:
- Merah: keberanian dan kekuatan menghadapi tantangan.
- Putih: kesucian hati, niat tulus, kejujuran dalam gerakan karate.
- Hitam (sabuk): keteguhan tekad dan percaya diri lewat latihan disiplin.
- Kuning: keanggunan kepribadian lewat pendidikan karate-do.

Motto: "Karate-Ka INKAI senantiasa memiliki Integritas tinggi, Tangguh dan Rendah Hati".
Detail gambar dan tampilan: /makna-lambang

## Struktur organisasi (halaman /struktur)
Hierarki: Pusat → Provinsi (Pengprov) → Cabang (mis. Surabaya) → Dojo/Ranting → Anggota.
Daftar pengurus dan struktur terkini tersedia di halaman /struktur pada portal (jangan mengarang nama pejabat).

## Keamanan siber (halaman /keamanan-siber)
Platform menyimpan data anggota, dojo, dan kegiatan. Pahami:
- Black hat: akses ilegal, pencurian data, malware — melanggar hukum (UU ITE).
- White hat: uji keamanan berizin, memperkuat sistem secara etis.
- Hacker (umum): ahli sistem; baik/buruk tergantung niat dan legalitas.
Komitmen portal: rate limit, validasi input, blokir akun PENDING sampai disetujui, pendaftaran hanya dojo Cabang Surabaya, security headers.
`.trim();
}
