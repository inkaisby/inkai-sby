import { prisma } from "@/lib/prisma";
import { buildMemberFilter, getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";

export type ReportColumnMeta = {
  key: string;
  label: string;
  defaultSelected: boolean;
  category: string;
};

export type ReportDomainMeta = {
  id: string;
  label: string;
  iconName: string;
  desc: string;
  category: string;
  columnsMeta: ReportColumnMeta[];
};

export type ReportFetchParams = {
  dojoId?: string;
  startDate?: string;
  endDate?: string;
  q?: string;
};

export type DomainHandler = {
  meta: ReportDomainMeta;
  fetcher: (params: ReportFetchParams, user: SessionUser) => Promise<Record<string, unknown>[]>;
};

export const DOMAIN_REGISTRY: Record<string, DomainHandler> = {
  anggota: {
    meta: {
      id: "anggota",
      label: "Anggota",
      iconName: "Users",
      desc: "Data Anggota & Sabuk",
      category: "Keorganisasian",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "nia", label: "NIA", defaultSelected: true, category: "Identitas" },
        { key: "fullName", label: "Nama Lengkap", defaultSelected: true, category: "Dasar" },
        { key: "dojoName", label: "Ranting / Dojo", defaultSelected: true, category: "Organisasi" },
        { key: "currentRank", label: "Sabuk / Kyu", defaultSelected: true, category: "Keanggotaan" },
        { key: "mshNumber", label: "No. MSH (Hitam)", defaultSelected: false, category: "Keanggotaan" },
        { key: "status", label: "Status Keanggotaan", defaultSelected: true, category: "Keanggotaan" },
        { key: "gender", label: "Jenis Kelamin", defaultSelected: false, category: "Identitas" },
        { key: "birthPlaceDate", label: "Tempat, Tanggal Lahir", defaultSelected: false, category: "Identitas" },
        { key: "nik", label: "NIK", defaultSelected: false, category: "Identitas" },
        { key: "phone", label: "No. HP / Telepon", defaultSelected: false, category: "Kontak" },
        { key: "email", label: "Email Login", defaultSelected: false, category: "Kontak" },
        { key: "duesPerMonth", label: "Iuran/Bulan", defaultSelected: false, category: "Keuangan" },
        { key: "createdAt", label: "Tanggal Daftar", defaultSelected: true, category: "Sistem" },
      ],
    },
    fetcher: async (params, user) => {
      const { dojoId, startDate, endDate, q } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const members = await prisma.member.findMany({
        where: {
          AND: [
            buildMemberFilter(user),
            dojoId ? { dojoId } : {},
            dateGte || dateLte ? { createdAt: { gte: dateGte, lte: dateLte } } : {},
            queryStr
              ? {
                  OR: [
                    { fullName: { contains: queryStr, mode: "insensitive" } },
                    { nia: { contains: queryStr, mode: "insensitive" } },
                    { mshNumber: { contains: queryStr, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        include: {
          dojo: { select: { name: true } },
          user: { select: { email: true, phoneNumber: true } },
        },
        orderBy: { fullName: "asc" },
        take: 1000,
      });

      return members.map((m, idx) => ({
        id: m.id,
        no: idx + 1,
        nia: m.nia || "—",
        fullName: m.fullName || "Tanpa Nama",
        dojoName: m.dojo?.name || "Luar Ranting / Umum",
        currentRank: m.currentRank || "—",
        mshNumber: m.mshNumber || "—",
        status: m.status || "Active",
        gender: m.gender === "MALE" ? "Laki-laki" : m.gender === "FEMALE" ? "Perempuan" : m.gender || "—",
        birthPlaceDate:
          [m.birthPlace, m.birthDate ? new Date(m.birthDate).toLocaleDateString("id-ID") : null]
            .filter(Boolean)
            .join(", ") || "—",
        nik: m.nik || "—",
        phone: m.user?.phoneNumber || "—",
        email: m.user?.email || "—",
        duesPerMonth: m.monthlyDuesAmount ? `Rp ${m.monthlyDuesAmount.toLocaleString("id-ID")}` : "Rp 25.000",
        createdAt: m.createdAt ? new Date(m.createdAt).toLocaleDateString("id-ID") : "—",
      }));
    },
  },

  kas: {
    meta: {
      id: "kas",
      label: "Kas Keuangan",
      iconName: "CircleDollarSign",
      desc: "Buku Mutasi Kas",
      category: "Keuangan",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "txnDate", label: "Tanggal Mutasi", defaultSelected: true, category: "Dasar" },
        { key: "kegiatan", label: "Kegiatan / Alokasi Pos", defaultSelected: true, category: "Kategori" },
        { key: "description", label: "Keterangan Transaksi", defaultSelected: true, category: "Dasar" },
        { key: "cashIn", label: "Kas Masuk (+)", defaultSelected: true, category: "Keuangan" },
        { key: "cashOut", label: "Kas Keluar (-)", defaultSelected: true, category: "Keuangan" },
        { key: "balance", label: "Saldo Akhir", defaultSelected: true, category: "Keuangan" },
        { key: "reconStatus", label: "Status Rekon", defaultSelected: false, category: "Audit" },
        { key: "sourceType", label: "Jenis Sumber", defaultSelected: false, category: "Audit" },
      ],
    },
    fetcher: async (params, user) => {
      const { dojoId, startDate, endDate, q } = params;
      const role = getPrimaryAdminRole(user.roles);
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const entries = await prisma.kasEntry.findMany({
        where: {
          AND: [
            role !== "ADMINISTRATOR" && role !== "ADMIN_PUSAT" && user.managedBranchId
              ? { scopeType: "branch", scopeId: user.managedBranchId }
              : {},
            dojoId ? { scopeType: "dojo", scopeId: dojoId } : {},
            dateGte || dateLte ? { txnDate: { gte: dateGte, lte: dateLte } } : {},
            queryStr
              ? {
                  OR: [
                    { description: { contains: queryStr, mode: "insensitive" } },
                    { kegiatan: { contains: queryStr, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        orderBy: [{ txnDate: "asc" }, { id: "asc" }],
        take: 1500,
      });

      let runningBalance = 0;
      return entries.map((e, idx) => {
        const inAmt = e.amountIn || 0;
        const outAmt = e.amountOut || 0;
        runningBalance += inAmt - outAmt;

        return {
          id: e.id,
          no: idx + 1,
          txnDate: e.txnDate ? new Date(e.txnDate).toLocaleDateString("id-ID") : "—",
          kegiatan: e.kegiatan || "Umum",
          description: e.description || "—",
          cashIn: inAmt > 0 ? `Rp ${inAmt.toLocaleString("id-ID")}` : "—",
          cashOut: outAmt > 0 ? `Rp ${outAmt.toLocaleString("id-ID")}` : "—",
          balance: `Rp ${runningBalance.toLocaleString("id-ID")}`,
          reconStatus: e.reconStatus === "MATCHED" || e.reconStatus === "matched" ? "✓ Cocok Rekening" : "Belum Rekon",
          sourceType: e.sourceType || "Manual",
        };
      });
    },
  },

  iuran: {
    meta: {
      id: "iuran",
      label: "Iuran Anggota",
      iconName: "Wallet",
      desc: "Status & Tunggakan Iuran",
      category: "Keuangan",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "nia", label: "NIA", defaultSelected: true, category: "Identitas" },
        { key: "fullName", label: "Nama Anggota", defaultSelected: true, category: "Dasar" },
        { key: "dojoName", label: "Ranting / Dojo", defaultSelected: true, category: "Organisasi" },
        { key: "currentRank", label: "Sabuk / Kyu", defaultSelected: true, category: "Keanggotaan" },
        { key: "monthlyDues", label: "Tagihan / Bulan", defaultSelected: true, category: "Keuangan" },
        { key: "statusBulan", label: "Status Keanggotaan", defaultSelected: true, category: "Status" },
        { key: "tunggakan", label: "Status Tagihan", defaultSelected: true, category: "Keuangan" },
        { key: "exception", label: "Bebas Iuran Event", defaultSelected: false, category: "Status" },
      ],
    },
    fetcher: async (params, user) => {
      const { dojoId, q } = params;
      const queryStr = q?.trim().toLowerCase() || "";

      const members = await prisma.member.findMany({
        where: {
          AND: [
            buildMemberFilter(user),
            dojoId ? { dojoId } : {},
            queryStr ? { fullName: { contains: queryStr, mode: "insensitive" } } : {},
          ],
        },
        include: {
          dojo: { select: { name: true } },
        },
        orderBy: { fullName: "asc" },
        take: 1000,
      });

      return members.map((m, idx) => ({
        id: m.id,
        no: idx + 1,
        nia: m.nia || "—",
        fullName: m.fullName || "Tanpa Nama",
        dojoName: m.dojo?.name || "—",
        currentRank: m.currentRank || "—",
        monthlyDues: `Rp ${(m.monthlyDuesAmount || 25000).toLocaleString("id-ID")}`,
        statusBulan: m.status || "Active",
        tunggakan: m.allowEventWithoutDues ? "Bebas Tagihan" : "Aktif Dues",
        exception: m.allowEventWithoutDues ? "Ya" : "Tidak",
      }));
    },
  },

  ukt: {
    meta: {
      id: "ukt",
      label: "UKT Ujian",
      iconName: "GraduationCap",
      desc: "Peserta & Kenaikan Sabuk",
      category: "Kegiatan & Event",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "eventTitle", label: "Event UKT", defaultSelected: true, category: "Event" },
        { key: "fullName", label: "Nama Peserta", defaultSelected: true, category: "Dasar" },
        { key: "nia", label: "NIA", defaultSelected: true, category: "Identitas" },
        { key: "dojoName", label: "Ranting / Dojo", defaultSelected: true, category: "Organisasi" },
        { key: "currentRank", label: "Sabuk / Kyu Saat Ini", defaultSelected: true, category: "Ujian" },
        { key: "targetBelt", label: "Sabuk Target (Pendaftaran)", defaultSelected: true, category: "Ujian" },
        { key: "paymentStatus", label: "Status Pendaftaran", defaultSelected: true, category: "Keuangan" },
        { key: "registeredAt", label: "Tanggal Daftar", defaultSelected: true, category: "Sistem" },
      ],
    },
    fetcher: async (params) => {
      const { dojoId, startDate, endDate, q } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const regs = await prisma.eventRegistration.findMany({
        where: {
          AND: [
            { event: { title: { contains: "UKT", mode: "insensitive" } } },
            dojoId ? { member: { dojoId } } : {},
            dateGte || dateLte ? { createdAt: { gte: dateGte, lte: dateLte } } : {},
            queryStr ? { member: { fullName: { contains: queryStr, mode: "insensitive" } } } : {},
          ],
        },
        include: {
          event: { select: { title: true } },
          member: { select: { fullName: true, nia: true, currentRank: true, dojo: { select: { name: true } } } },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      return regs.map((r, idx) => ({
        id: r.id,
        no: idx + 1,
        eventTitle: r.event?.title || "UKT INKAI Surabaya",
        fullName: r.member?.fullName || "—",
        nia: r.member?.nia || "—",
        dojoName: r.member?.dojo?.name || "—",
        currentRank: r.member?.currentRank || "—",
        targetBelt: r.registeredRank || r.category?.name || "—",
        paymentStatus: r.status === "PAID" ? "LUNAS" : r.status === "CONFIRMED" ? "DIVERIFIKASI" : r.status,
        registeredAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString("id-ID") : "—",
      }));
    },
  },

  latber: {
    meta: {
      id: "latber",
      label: "Latihan Bersama",
      iconName: "Swords",
      desc: "Walk-in & Tamu Latber",
      category: "Kegiatan & Event",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "eventTitle", label: "Event Latber", defaultSelected: true, category: "Event" },
        { key: "fullName", label: "Nama Peserta", defaultSelected: true, category: "Dasar" },
        { key: "nia", label: "NIA", defaultSelected: true, category: "Identitas" },
        { key: "dojoName", label: "Ranting / Dojo", defaultSelected: true, category: "Organisasi" },
        { key: "status", label: "Status Pendaftaran", defaultSelected: true, category: "Keuangan" },
        { key: "registeredAt", label: "Tanggal Daftar", defaultSelected: true, category: "Sistem" },
      ],
    },
    fetcher: async (params) => {
      const { dojoId, startDate, endDate } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;

      const regs = await prisma.eventRegistration.findMany({
        where: {
          AND: [
            { event: { title: { contains: "Latber", mode: "insensitive" } } },
            dojoId ? { member: { dojoId } } : {},
            dateGte || dateLte ? { createdAt: { gte: dateGte, lte: dateLte } } : {},
          ],
        },
        include: {
          event: { select: { title: true } },
          member: { select: { fullName: true, nia: true, dojo: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      return regs.map((r, idx) => ({
        id: r.id,
        no: idx + 1,
        eventTitle: r.event?.title || "Latihan Bersama INKAI",
        fullName: r.member?.fullName || "—",
        nia: r.member?.nia || "—",
        dojoName: r.member?.dojo?.name || "—",
        status: r.status === "PAID" || r.status === "CONFIRMED" ? "LUNAS" : r.status,
        registeredAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString("id-ID") : "—",
      }));
    },
  },

  pertandingan: {
    meta: {
      id: "pertandingan",
      label: "Kejuaraan",
      iconName: "Trophy",
      desc: "Atlet, Kelas & Medali",
      category: "Kegiatan & Event",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "athleteName", label: "Nama Atlet", defaultSelected: true, category: "Dasar" },
        { key: "dojoKontingen", label: "Dojo / Kontingen", defaultSelected: true, category: "Organisasi" },
        { key: "classCategory", label: "Kelas Pertandingan", defaultSelected: true, category: "Kompetisi" },
        { key: "gender", label: "Jenis Kelamin", defaultSelected: false, category: "Identitas" },
        { key: "weightBb", label: "Berat Badan (BB)", defaultSelected: true, category: "Kompetisi" },
        { key: "medal", label: "Prestasi / Medali", defaultSelected: true, category: "Hasil" },
        { key: "paymentMethod", label: "Metode Pembayaran", defaultSelected: false, category: "Keuangan" },
        { key: "verificationStatus", label: "Status Verifikasi", defaultSelected: true, category: "Status" },
      ],
    },
    fetcher: async (params) => {
      const { dojoId, startDate, endDate, q } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const regs = await prisma.tournamentRegistration.findMany({
        where: {
          AND: [
            dojoId ? { dojoId } : {},
            dateGte || dateLte ? { createdAt: { gte: dateGte, lte: dateLte } } : {},
            queryStr ? { member: { fullName: { contains: queryStr, mode: "insensitive" } } } : {},
          ],
        },
        include: {
          category: { select: { name: true } },
          dojo: { select: { name: true } },
          member: { select: { fullName: true, gender: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      return regs.map((r, idx) => ({
        id: r.id,
        no: idx + 1,
        athleteName: r.member?.fullName || r.officialName || "—",
        dojoKontingen: r.dojo?.name || "—",
        classCategory: r.category?.name || "—",
        gender: r.member?.gender === "MALE" ? "Laki-laki" : r.member?.gender === "FEMALE" ? "Perempuan" : "—",
        weightBb: r.actualWeight ? `${r.actualWeight} kg` : "—",
        medal:
          r.medal === "GOLD"
            ? "🥇 Emas (Juara 1)"
            : r.medal === "SILVER"
              ? "🥈 Perak (Juara 2)"
              : r.medal === "BRONZE"
                ? "🥉 Perunggu (Juara 3)"
                : "Peserta",
        paymentMethod: r.paymentMethod === "CASH" ? "💵 Tunai" : "🏦 Transfer / QRIS",
        verificationStatus:
          r.status === "VERIFIED" ? "✓ SAH / VERIFIED" : r.status === "PAID" ? "LUNAS" : r.status === "REJECTED" ? "DITOLAK" : "REGISTERED",
      }));
    },
  },

  absensi: {
    meta: {
      id: "absensi",
      label: "Absensi",
      iconName: "ClipboardCheck",
      desc: "Check-in GPS & Scan QR",
      category: "Kegiatan & Event",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "date", label: "Tanggal Absen", defaultSelected: true, category: "Dasar" },
        { key: "memberName", label: "Nama Anggota", defaultSelected: true, category: "Dasar" },
        { key: "dojoName", label: "Lokasi Dojo Absen", defaultSelected: true, category: "Organisasi" },
        { key: "checkInTime", label: "Jam Check-in", defaultSelected: true, category: "Absen" },
        { key: "geofenceStatus", label: "Metode Absen", defaultSelected: true, category: "Absen" },
      ],
    },
    fetcher: async (params) => {
      const { dojoId, startDate, endDate, q } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const attendances = await prisma.attendance.findMany({
        where: {
          AND: [
            dojoId ? { dojoId } : {},
            dateGte || dateLte ? { checkInAt: { gte: dateGte, lte: dateLte } } : {},
            queryStr ? { member: { fullName: { contains: queryStr, mode: "insensitive" } } } : {},
          ],
        },
        include: {
          member: { select: { fullName: true } },
          dojo: { select: { name: true } },
        },
        orderBy: { checkInAt: "desc" },
        take: 1000,
      });

      return attendances.map((a, idx) => ({
        id: a.id,
        no: idx + 1,
        date: a.checkInAt ? new Date(a.checkInAt).toLocaleDateString("id-ID") : "—",
        memberName: a.member?.fullName || "—",
        dojoName: a.dojo?.name || "—",
        checkInTime: a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—",
        geofenceStatus: a.method === "GPS" ? "✓ GPS Geofence" : a.method === "QR_SCAN" ? "✓ Scan Kode QR Dojo" : a.method,
      }));
    },
  },

  surat: {
    meta: {
      id: "surat",
      label: "Surat & Persuratan",
      iconName: "FileText",
      desc: "Surat Masuk & Keluar Sekretariat",
      category: "Administrasi & Audit",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "type", label: "Jenis Surat", defaultSelected: true, category: "Dasar" },
        { key: "nomorSurat", label: "Nomor Surat", defaultSelected: true, category: "Identitas" },
        { key: "tanggalSurat", label: "Tanggal Surat", defaultSelected: true, category: "Dasar" },
        { key: "perihal", label: "Perihal", defaultSelected: true, category: "Konten" },
        { key: "kategori", label: "Kategori Surat", defaultSelected: true, category: "Konten" },
        { key: "pengirim", label: "Pengirim / Instansi", defaultSelected: false, category: "Instansi" },
        { key: "tujuan", label: "Tujuan Surat", defaultSelected: false, category: "Instansi" },
        { key: "status", label: "Status Dokumen", defaultSelected: true, category: "Status" },
        { key: "paperSize", label: "Ukuran Kertas", defaultSelected: false, category: "Spesifikasi" },
      ],
    },
    fetcher: async (params) => {
      const { startDate, endDate, q } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const surats = await prisma.suratEntry.findMany({
        where: {
          AND: [
            dateGte || dateLte ? { tanggalSurat: { gte: dateGte, lte: dateLte } } : {},
            queryStr
              ? {
                  OR: [
                    { nomorSurat: { contains: queryStr, mode: "insensitive" } },
                    { perihal: { contains: queryStr, mode: "insensitive" } },
                    { pengirim: { contains: queryStr, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        orderBy: { tanggalSurat: "desc" },
        take: 1000,
      });

      return surats.map((s, idx) => ({
        id: s.id,
        no: idx + 1,
        type: s.type === "MASUK" ? "📥 Surat Masuk" : "📤 Surat Keluar",
        nomorSurat: s.nomorSurat || "—",
        tanggalSurat: s.tanggalSurat ? new Date(s.tanggalSurat).toLocaleDateString("id-ID") : "—",
        perihal: s.perihal || "—",
        kategori: s.kategori || "UNDANGAN",
        pengirim: s.pengirim || "—",
        tujuan: s.tujuan || "—",
        status: s.status || "DRAFT",
        paperSize: s.paperSize || "A4",
      }));
    },
  },

  verifikasi: {
    meta: {
      id: "verifikasi",
      label: "Riwayat Verifikasi",
      iconName: "ShieldCheck",
      desc: "Klaim Profile & Berkas",
      category: "Administrasi & Audit",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "memberName", label: "Nama Anggota", defaultSelected: true, category: "Dasar" },
        { key: "type", label: "Tipe Verifikasi", defaultSelected: true, category: "Verifikasi" },
        { key: "status", label: "Status Verifikasi", defaultSelected: true, category: "Status" },
        { key: "createdAt", label: "Tanggal Pengajuan", defaultSelected: true, category: "Sistem" },
        { key: "adminNotes", label: "Catatan Admin", defaultSelected: false, category: "Audit" },
        { key: "hasProof", label: "Dokumen Bukti", defaultSelected: false, category: "Verifikasi" },
      ],
    },
    fetcher: async (params) => {
      const { startDate, endDate, q } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const verifications = await prisma.verification.findMany({
        where: {
          AND: [
            dateGte || dateLte ? { createdAt: { gte: dateGte, lte: dateLte } } : {},
            queryStr ? { member: { fullName: { contains: queryStr, mode: "insensitive" } } } : {},
          ],
        },
        include: {
          member: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      return verifications.map((v, idx) => ({
        id: v.id,
        no: idx + 1,
        memberName: v.member?.fullName || "—",
        type: v.type || "PROFILE_CLAIM",
        status: v.status === "APPROVED" ? "✓ DISETUJUI" : v.status === "REJECTED" ? "DITOLAK" : "PENDING",
        createdAt: v.createdAt ? new Date(v.createdAt).toLocaleDateString("id-ID") : "—",
        adminNotes: v.adminNotes || "—",
        hasProof: v.proofUrl ? "Ada Berkas Bukti" : "Tidak Ada",
      }));
    },
  },

  store: {
    meta: {
      id: "store",
      label: "Produk Store",
      iconName: "ShoppingBag",
      desc: "Pesanan Karategi & Merchandise",
      category: "Layanan & Produk",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "orderId", label: "ID Pesanan", defaultSelected: true, category: "Identitas" },
        { key: "memberName", label: "Nama Pemesan", defaultSelected: true, category: "Dasar" },
        { key: "total", label: "Total Belanja", defaultSelected: true, category: "Keuangan" },
        { key: "status", label: "Status Pesanan", defaultSelected: true, category: "Status" },
        { key: "note", label: "Catatan Pesanan", defaultSelected: false, category: "Detail" },
        { key: "createdAt", label: "Tanggal Pesan", defaultSelected: true, category: "Sistem" },
      ],
    },
    fetcher: async (params) => {
      const { startDate, endDate, q } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const orders = await prisma.storeOrder.findMany({
        where: {
          AND: [
            dateGte || dateLte ? { createdAt: { gte: dateGte, lte: dateLte } } : {},
            queryStr ? { member: { fullName: { contains: queryStr, mode: "insensitive" } } } : {},
          ],
        },
        include: {
          member: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      return orders.map((o, idx) => ({
        id: o.id,
        no: idx + 1,
        orderId: `ORD-${o.id.substring(0, 8).toUpperCase()}`,
        memberName: o.member?.fullName || "—",
        total: `Rp ${(o.total || 0).toLocaleString("id-ID")}`,
        status: o.status === "PAID" ? "LUNAS" : o.status === "SHIPPED" ? "DIKIRIM" : o.status,
        note: o.note || "—",
        createdAt: o.createdAt ? new Date(o.createdAt).toLocaleDateString("id-ID") : "—",
      }));
    },
  },

  audit: {
    meta: {
      id: "audit",
      label: "Log Audit Sistem",
      iconName: "History",
      desc: "Jejak Aktivitas & Keamanan",
      category: "Administrasi & Audit",
      columnsMeta: [
        { key: "no", label: "No", defaultSelected: true, category: "Dasar" },
        { key: "createdAt", label: "Tanggal & Waktu", defaultSelected: true, category: "Dasar" },
        { key: "email", label: "Email User / Pengurus", defaultSelected: true, category: "Identitas" },
        { key: "action", label: "Aksi System", defaultSelected: true, category: "Aktivitas" },
        { key: "details", label: "Rincian Detail", defaultSelected: true, category: "Aktivitas" },
        { key: "ip", label: "IP Address", defaultSelected: false, category: "Keamanan" },
        { key: "location", label: "Lokasi CDN", defaultSelected: false, category: "Keamanan" },
      ],
    },
    fetcher: async (params) => {
      const { startDate, endDate, q } = params;
      const dateGte = startDate ? new Date(startDate + "T00:00:00.000Z") : undefined;
      const dateLte = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;
      const queryStr = q?.trim().toLowerCase() || "";

      const logs = await prisma.auditLog.findMany({
        where: {
          AND: [
            dateGte || dateLte ? { createdAt: { gte: dateGte, lte: dateLte } } : {},
            queryStr
              ? {
                  OR: [
                    { action: { contains: queryStr, mode: "insensitive" } },
                    { email: { contains: queryStr, mode: "insensitive" } },
                    { details: { contains: queryStr, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      return logs.map((l, idx) => ({
        id: l.id,
        no: idx + 1,
        createdAt: l.createdAt
          ? `${new Date(l.createdAt).toLocaleDateString("id-ID")} ${new Date(l.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
          : "—",
        email: l.email || "—",
        action: l.action || "SYSTEM_EVENT",
        details: l.details || "—",
        ip: l.ip || "—",
        location: l.location || "—",
      }));
    },
  },
};

/**
 * Returns available report domain metadata for dynamic frontend UI auto-discovery
 */
export function getAvailableReportDomains(): ReportDomainMeta[] {
  return Object.values(DOMAIN_REGISTRY).map((item) => item.meta);
}

/**
 * Fetches report data dynamically based on domain ID
 */
export async function fetchReportDataForDomain(
  domainId: string,
  params: ReportFetchParams,
  user: SessionUser,
) {
  const handler = DOMAIN_REGISTRY[domainId] || DOMAIN_REGISTRY["anggota"];
  const data = await handler.fetcher(params, user);
  return {
    meta: handler.meta,
    data,
  };
}
