export interface PresentationScene {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  category: string;
  badge: string;
  durationSeconds: number; // default duration in seconds
  narration: string; // Teks script voiceover / pembicara
  points: string[];
  visualType:
  | "url-typing"
  | "auth-flow"
  | "rbac-hierarchy"
  | "member-portal"
  | "admin-members"
  | "ukt-latber"
  | "tournament-wasit"
  | "kas-sekretariat"
  | "outro-contact";
  mockupData?: Record<string, unknown>;
}

export const DEFAULT_SCENES: PresentationScene[] = [
  {
    id: "scene-1",
    order: 1,
    title: "Akses Portal Publik & Ekosistem Terbuka",
    subtitle: "Mulai dari mengetik https://inkai-sby.vercel.app di peramban Anda",
    category: "Akses Publik & Identitas",
    badge: "01 · Portal Publik",
    durationSeconds: 32,
    narration: "Selamat datang di Portal Resmi Institut Karate-Do Indonesia Cabang Surabaya. Cukup dengan membuka https://inkai-sby.vercel.app, masyarakat dan karateka langsung disambut dengan Logo 3D INKAI yang dinamis, chip pengumuman kegiatan aktif yang berdenyut, direktori dojo seluruh Surabaya, roster pendaftaran UKT publik, walk-in Latihan Bersama, portal kejuaraan, serta asisten cerdas Tanya INKAI yang siap melayani 24 jam.",
    points: [
      "Animasi Logo INKAI 3D CSS (float, tilt & kilau reflektif)",
      "Floating Chip Kegiatan Terbuka: status UKT, Latber, dan Kejuaraan aktif",
      "Direktori Dojo & Ranting Surabaya: peta, jadwal latihan, dan kontak PIC",
      "Roster UKT & Walk-in Latber: cek peserta & bayar QRIS tanpa login",
      "Tanya INKAI: Asisten AI interaktif untuk panduan pendaftaran"
    ],
    visualType: "url-typing",
    mockupData: {
      url: "https://inkai-sby.vercel.app",
      activeEvents: ["UKT Semester II-2026", "Latber Persiapan UKT", "Kejurprov FORKI 2026"],
      totalDojos: 28,
      assistantName: "Tanya INKAI"
    }
  },
  {
    id: "scene-2",
    order: 2,
    title: "Registrasi, Verifikasi Akun & Reset Password",
    subtitle: "Alur pendaftaran terstruktur 4 tahap & sistem keamanan akun mandiri",
    category: "Keamanan & Autentikasi",
    badge: "02 · Siklus Akun",
    durationSeconds: 35,
    narration: "Pendaftaran karateka baru dirancang sangat rapi dalam 4 tahap: pemilihan Dojo, pengisian Identitas lengkap dengan NIK 16 digit dan validasi duplikat instan, pemilihan tingkatan Sabuk dan Nomor MSH bagi pemegang DAN, serta pembuatan Akun. Sistem mendukung verifikasi otomatis langsung aktif sekaligus mengirimkan notifikasi instan ke pengurus ranting. Anggota juga dapat login via Email maupun NIA, serta melakukan reset password mandiri atau dibantu admin ranting.",
    points: [
      "Form 4 Tahap Terstruktur: Dojo ➔ Identitas ➔ Sabuk/MSH ➔ Akun",
      "Deteksi Duplikat Real-time: cegah bentrok NIK, NIA, dan nama karateka",
      "Otomatisasi Verifikasi: akun langsung aktif & notifikasi admin ranting",
      "Multi-Identifier Login: masuk via Email atau NIA dengan normalisasi format",
      "Reset Password Mandiri via Email atau Password Sementara oleh Admin"
    ],
    visualType: "auth-flow",
    mockupData: {
      steps: ["1. Pilih Ranting", "2. Identitas & NIK", "3. Sabuk & No. MSH", "4. Akun Email/Pass"],
      authTypes: ["Email", "NIA (Nomor Induk Anggota)"],
      adminResetPattern: "NIA / Nama####"
    }
  },
  {
    id: "scene-3",
    order: 3,
    title: "Hierarki Wilayah & Multi-Role RBAC",
    subtitle: "Manajemen hak akses 5 level dari Anggota hingga Pengurus Pusat",
    category: "Tata Kelola Wilayah",
    badge: "03 · Struktur RBAC",
    durationSeconds: 34,
    narration: "Tata kelola organisasi INKAI Surabaya ditegakkan dengan kontrol akses wilayah yang presisi. Mulai dari Anggota dan Orang Tua, Admin Ranting yang mengelola dojo masing-masing, Admin Cabang dengan wewenang penuh se-Surabaya, Admin Pengprov Jawa Timur untuk penugasan NIA, hingga Administrator Pusat. Dilengkapi fitur unggulan Pindah Peran Cepat atau Ambil Alih Sesi satu klik tanpa perlu logout untuk pengurus cabang dan superadmin.",
    points: [
      "5 Tingkat Peran: Anggota, Admin Dojo, Admin Cabang, Pengprov, dan Administrator",
      "Pembatasan Scope Wilayah: Admin ranting terkunci aman pada dojo masing-masing",
      "Dual-Role Cerdas: 1 Akun bisa menjadi Anggota sekaligus Pengurus Cabang/Ranting",
      "Pindah Peran Cepat (⚡ Role Switcher): ambil alih sesi instan antar tingkatan",
      "Pemantauan Kehadiran Sesi Live: cabut sesi atau kunci akun yang mencurigakan"
    ],
    visualType: "rbac-hierarchy",
    mockupData: {
      roles: [
        { name: "Pengurus Pusat / Superadmin", level: "Nasional", icon: "Landmark" },
        { name: "Pengprov Jawa Timur", level: "Provinsi (Penetapan NIA)", icon: "Building" },
        { name: "Pengurus Cabang Surabaya", level: "Kota (Otoritas UKT & Kas)", icon: "Shield" },
        { name: "Pengurus Ranting / Dojo", level: "28+ Dojo se-Surabaya", icon: "Users" },
        { name: "Karateka & Orang Tua", level: "Portal Mandiri Anggota", icon: "User" }
      ]
    }
  },
  {
    id: "scene-4",
    order: 4,
    title: "Portal Anggota Mandiri (/dashboard)",
    subtitle: "Asisten digital lengkap untuk setiap karateka INKAI Surabaya",
    category: "Pengalaman Anggota",
    badge: "04 · Portal Anggota",
    durationSeconds: 38,
    narration: "Di dalam dashboard anggota, setiap karateka memiliki Kartu Anggota Digital ber-QR Code yang siap diverifikasi di manapun. Absensi latihan bekerja pintar dengan geofence GPS 150 meter otomatis atau scan barcode dojo live, bahkan mendukung latihan lintas dojo. Anggota dapat memantau akumulasi kehadiran menuju ambang 75 persen syarat UKT, melaporkan iuran bulanan, mendaftar kejuaraan Kata dan Kumite, serta mengunduh materi dan dokumen resmi.",
    points: [
      "Kartu Anggota Digital QR: terhubung ke verifikasi keabsahan publik /v/[id]",
      "Absensi GPS & Scan QR: validasi jarak 150m, multi-dojo & biometrik HP",
      "Indikator Kelayakan Ujian: pelacak otomatis target 75% kehadiran semester",
      "Lapor Setor Iuran: transparan tanpa ribet dengan rekonsiliasi pengurus",
      "Daftar Kejuaraan & UKT Mandiri: pilih kelas tanding & pantau hasil sabuk"
    ],
    visualType: "member-portal",
    mockupData: {
      memberName: "AHMAD FAUZI PRATAMA",
      memberNia: "35.78.01.2024.089",
      beltRank: "Kyu 4 (Biru)",
      attendanceRate: "85% (Layak UKT)",
      totalHadir: "41 / 48 Sesi"
    }
  },
  {
    id: "scene-5",
    order: 5,
    title: "Keanggotaan Admin & Spreadsheet Density 14 Inci",
    subtitle: "Pengelolaan ribuan data karateka dengan kecepatan instan",
    category: "Administrasi Anggota",
    badge: "05 · Kelola Anggota",
    durationSeconds: 36,
    narration: "Bagi administrator dan ketua ranting, modul Kelola Anggota dirancang dengan standar Spreadsheet Density 14 Inci yang sangat padat dan efisien. Pencarian real-time memfilter ribuan anggota seketika. Fitur Quick-Register memungkinkan pendaftaran UKT, Latber, dan Kejuaraan dalam satu klik. Dilengkapi Input Massal copy-paste langsung dari Excel hingga 50 karateka, auto-provision akun login ber-NIA, serta cetak kartu barcode massal standar KTP PVC.",
    points: [
      "Tampilan Spreadsheet Kepadatan Tinggi: 15+ baris terlihat sekaligus tanpa scroll berlebih",
      "Pencarian Autocomplete Cerdas: filter instan nama, NIA, sabuk, dan ranting",
      "Quick-Action Event: daftarkan UKT, Latber, dan Kejuaraan langsung dari tabel",
      "Input Massal Excel: tempel puluhan baris data dan auto-generate akun login",
      "Cetak Kartu PVC / KTP CR80: format standar 10 kartu per lembar A4/F4"
    ],
    visualType: "admin-members",
    mockupData: {
      totalMembers: 1248,
      activeMembers: 1180,
      pendingApproval: 12,
      withoutNia: 45,
      bulkCapacity: "50 karateka / batch"
    }
  },
  {
    id: "scene-6",
    order: 6,
    title: "Siklus Ujian (UKT) & Latihan Bersama (Latber)",
    subtitle: "Digitalisasi penuh dari pendaftaran hingga penetapan sabuk baru",
    category: "Operasional Ujian & Latihan",
    badge: "06 · UKT & Latber",
    durationSeconds: 40,
    narration: "Modul UKT dan Latber merevolusi operasional ujian cabang Surabaya. Mulai dari wizard periode semester, validasi prasyarat iuran dan kehadiran, hingga penerbitan nota pembayaran resmi. Fitur Scan Express Kyu Baru memungkinkan panitia mengunggah kenaikan sabuk seketika lewat scanner barcode dengan konfirmasi audio beep. Sistem juga menghasilkan Rekapitulasi Matrix UKT Ranting kali Sabuk satu halaman utuh dan ekspor Excel format Pengda Jawa Timur.",
    points: [
      "Alur Status Terpadu: Belum Bayar ➔ Verifikasi ➔ Menunggu Ujian ➔ Lulus/Selesai",
      "⚡ Scan Express Kyu Baru: barcode scanner live dengan konfirmasi audio beep",
      "Rekapitulasi Matrix UKT: rekap 28 ranting × tingkat sabuk muat 1 lembar A4/F4",
      "Ekspor Excel Format Pengda: 2 sheet resmi lengkap dengan lembar tanda tangan",
      "Latihan Bersama (Latber): walk-in publik, komisi ranting otomatis, kredit absensi"
    ],
    visualType: "ukt-latber",
    mockupData: {
      period: "UKT Semester II-2026",
      participants: 342,
      verifiedPaid: "Rp 34.200.000",
      belts: ["Putih", "Kuning", "Hijau", "Biru", "Cokelat", "Hitam DAN"],
      scannerMode: "Live Barcode Audio Beep Active"
    }
  },
  {
    id: "scene-7",
    order: 7,
    title: "Kejuaraan Karate & Sertifikasi Wasit-Juri",
    subtitle: "Pentas prestasi atlet dan lisensi resmi perwasitan",
    category: "Kompetisi & Wasit Juri",
    badge: "07 · Prestasi & Lisensi",
    durationSeconds: 38,
    narration: "Ekosistem inkai-sby mencakup manajemen Kejuaraan Pertandingan dengan lebih dari 85 kategori kelas standar Kata dan Kumite, deteksi usia otomatis dari tanggal lahir, timbang badan inline, cetak ID Card atlet, hingga perolehan medali dan klasemen Juara Umum Dojo. Disertai modul Sertifikasi Wasit & Juri untuk penataran dan perpanjangan lisensi Juri dan Wasit A/B, penarikan riwayat lisensi otomatis, verifikasi berkas DAN, dan pencatatan kas terintegrasi.",
    points: [
      "Manajemen ~85 Kelas Pertandingan: Open, Pelajar, Disabilitas, Veteran, BOB",
      "Pemetaan Usia Otomatis: konversi tanggal lahir ke kelas usia karate resmi",
      "Timbang Badan & Berkas Atlet: input berat badan live dan verifikasi dokumen",
      "Klasemen Medali & Juara Umum: kalkulasi otomatis poin Emas, Perak, Perunggu",
      "Sertifikasi Wasit & Juri: penataran/refreshing Juri B/A & Wasit B/A terintegrasi kas"
    ],
    visualType: "tournament-wasit",
    mockupData: {
      tournamentName: "Kejurprov FORKI Jawa Timur 2026",
      totalAthletes: 420,
      totalCategories: 86,
      wasitJuriClasses: ["Juri B", "Juri A", "Wasit B", "Wasit A"],
      currentLicenseBatch: "Penataran & Refreshing Wasit Cabang 2026"
    }
  },
  {
    id: "scene-8",
    order: 8,
    title: "Keuangan Kas, Sekretariat, AI & Keamanan",
    subtitle: "Transparansi mutasi, persuratan digital, dan kecerdasan analitik",
    category: "Tata Kelola & Keuangan",
    badge: "08 · Tata Kelola & AI",
    durationSeconds: 42,
    narration: "Pilar penutup sistem menghadirkan transparansi penuh: Buku Kas Cabang dan Ranting dengan Jatah Anggaran Pos Alokasi, grafik keuangan interaktif, dan analisis SWOT otomatis yang siap dicetak resmi. Modul Sekretariat menyediakan generator surat digital dengan Kop FORKI dan INKAI, tanda tangan digital kanvas, stempel resmi, dan QR verifikasi publik. Dilengkapi Universal AI Insight untuk analitik multi-domain serta log audit keamanan komprehensif.",
    points: [
      "Buku Kas Detail & Jatah Pos Alokasi: 35% Pembinaan, 20% Duka, 15% Investasi, dll",
      "Grafik Interaktif & SWOT Keuangan Otomatis pada cetakan PDF/Excel A4/F4",
      "Generator Surat WYSIWYG: TTD digital canvas, stempel resmi & QR keabsahan",
      "Universal AI Analytics: kueri bahasa alami untuk data atlet, kas, UKT, dan dojo",
      "Keamanan & Audit Log: enkripsi data, pembatasan hak akses, dan jejak sesi aktif"
    ],
    visualType: "kas-sekretariat",
    mockupData: {
      kasBalance: "Rp 48.650.000",
      posAllocation: "35% Pembinaan · 20% Sosial · 15% Investasi · 15% Insidentil · 10% Sarpras",
      suratFormat: "[No]/INKAI-KOTA.SBY/[Kode]/[Bulan]/[Tahun]",
      aiEngine: "Tanya INKAI Universal Multi-Domain Analytics"
    }
  },
  {
    id: "scene-9",
    order: 9,
    title: "Sinergi, Nilai Luhur & Kontak Sekretariat",
    subtitle: "Membangun ekosistem karateka Surabaya berintegritas dan berprestasi emas",
    category: "Penutup & Kontak",
    badge: "09 · Sinergi & Kontak",
    durationSeconds: 35,
    narration: "Demikian paparan ekosistem digital INKAI Cabang Surabaya. Dengan memegang teguh lima Sumpah Karate: memelihara kepribadian, patuh pada kejujuran, mempertinggi prestasi, menjaga sopan santun, dan menguasai diri, sistem ini hadir untuk memperkuat persaudaraan karateka dan profesionalisme cabang. Untuk konsultasi pendaftaran ranting dan kegiatan, silakan hubungi Sekretariat Pengcab INKAI Surabaya via WhatsApp 085731241840 atau kunjungi portal inkai-sby.vercel.app. Osh!",
    points: [
      "5 Nilai Luhur Sumpah Karate: kepribadian, kejujuran, prestasi, sopan santun, penguasaan diri",
      "Pusat Layanan Terpadu: Sekretariat Pengurus Cabang INKAI Kota Surabaya",
      "Hotline Resmi WhatsApp: +62 857-3124-1840 (konsultasi ranting, UKT, dan atlet)",
      "Portal Publik Terbuka: https://inkai-sby.vercel.app siap diakses seluruh warga",
      "Sinergi Berkelanjutan: integritas data, efisiensi waktu, dan transparansi organisasi"
    ],
    visualType: "outro-contact",
    mockupData: {
      hotline: "+62 857-3124-1840",
      website: "https://inkai-sby.vercel.app",
      motto: "Integritas · Disiplin · Tangguh · Berprestasi"
    }
  }
];

const LOCAL_STORAGE_KEY = "inkai_presentation_scenes_v2";

export function loadPresentationScenes(): PresentationScene[] {
  if (typeof window === "undefined") {
    return DEFAULT_SCENES;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return DEFAULT_SCENES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error("Gagal membaca scenes presentasi dari localStorage:", err);
  }
  return DEFAULT_SCENES;
}

export function savePresentationScenes(scenes: PresentationScene[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scenes));
  } catch (err) {
    console.error("Gagal menyimpan scenes presentasi ke localStorage:", err);
  }
}

export function resetPresentationScenes(): PresentationScene[] {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err) {
      console.error("Gagal me-reset scenes presentasi:", err);
    }
  }
  return DEFAULT_SCENES;
}

