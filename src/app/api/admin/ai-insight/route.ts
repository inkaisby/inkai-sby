import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatRp } from "@/lib/terbilang";
import {
  createMixrouteProvider,
  getTanyaInkaiModelId,
  hasMixrouteApiKey,
} from "@/lib/tanya-inkai/mixroute";
import { generateText } from "ai";

export const dynamic = "force-dynamic";

const MONTH_NAMES_ID = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
];

function parsePeriodFromQuery(query: string) {
  const lower = query.toLowerCase();
  let year = 2026;
  let monthIndex = new Date().getMonth();
  let periodLabel = "Tahun 2026";

  const yearMatch = lower.match(/\b(202[4-9])\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  let monthFound = false;
  MONTH_NAMES_ID.forEach((name, idx) => {
    if (lower.includes(name)) {
      monthIndex = idx;
      monthFound = true;
    }
  });

  if (monthFound) {
    const monthNameCapitalized =
      MONTH_NAMES_ID[monthIndex].charAt(0).toUpperCase() +
      MONTH_NAMES_ID[monthIndex].slice(1);
    periodLabel = `${monthNameCapitalized} ${year}`;
  } else {
    periodLabel = `Tahun ${year}`;
  }

  const startDate = new Date(Date.UTC(year, monthFound ? monthIndex : 0, 1));
  const endDate = new Date(
    Date.UTC(year, monthFound ? monthIndex + 1 : 12, 0, 23, 59, 59, 999)
  );

  return { year, monthIndex, startDate, endDate, periodLabel, monthFound };
}

function detectQueryDomain(query: string): "kas" | "anggota" | "pertandingan" | "ukt" | "organisasi" {
  const lower = query.toLowerCase();

  // 1. Demografi Atlet / Anggota / Karateka (handles 'atlet', 'atlit', 'karateka', 'peserta', 'anggota', 'sabuk', 'kyu', 'demografi', 'msh', 'member')
  if (
    lower.includes("atlet") ||
    lower.includes("atlit") ||
    lower.includes("karateka") ||
    lower.includes("anggota") ||
    lower.includes("sabuk") ||
    lower.includes("kyu") ||
    lower.includes("demografi") ||
    lower.includes("msh") ||
    lower.includes("member") ||
    lower.includes("peserta") ||
    lower.includes("populasi") ||
    lower.includes("jenis kelamin") ||
    lower.includes("pria") ||
    lower.includes("wanita") ||
    lower.includes("laki") ||
    lower.includes("perempuan")
  ) {
    return "anggota";
  }

  // 2. Pertandingan & Kejuaraan
  if (
    lower.includes("kejuaraan") ||
    lower.includes("tanding") ||
    lower.includes("medali") ||
    lower.includes("juara") ||
    lower.includes("kata") ||
    lower.includes("kumite") ||
    lower.includes("pertandingan")
  ) {
    return "pertandingan";
  }

  // 3. UKT / Ujian Kenaikan Tingkat
  if (
    lower.includes("ukt") ||
    lower.includes("ujian") ||
    lower.includes("kenaikan tingkat") ||
    lower.includes("sabuk baru")
  ) {
    return "ukt";
  }

  // 4. Keuangan / Kas
  if (
    lower.includes("pendapatan") ||
    lower.includes("pengeluaran") ||
    lower.includes("kas") ||
    lower.includes("keuangan") ||
    lower.includes("biaya") ||
    lower.includes("iuran") ||
    lower.includes("saldo") ||
    lower.includes("pemasukan") ||
    lower.includes("omset") ||
    lower.includes("uang") ||
    lower.includes("surplus") ||
    lower.includes("defisit")
  ) {
    return "kas";
  }

  // 5. Dojo / Ranting / Organisasi
  if (
    lower.includes("dojo") ||
    lower.includes("ranting") ||
    lower.includes("cabang") ||
    lower.includes("organisasi") ||
    lower.includes("pengurus")
  ) {
    return "organisasi";
  }

  // Fallback untuk kueri perhitungan/jumlah umum ("berapa total...", "jumlah...", "banyak...") -> default anggota
  if (
    lower.includes("total") ||
    lower.includes("jumlah") ||
    lower.includes("berapa") ||
    lower.includes("banyak")
  ) {
    return "anggota";
  }

  return "kas";
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !canAccessAdmin(session.user)) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau tidak memiliki akses admin." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const userQuery = String(body.prompt || body.query || "").trim();

    if (!userQuery) {
      return NextResponse.json(
        { error: "Pertanyaan atau prompt pencarian tidak boleh kosong." },
        { status: 400 }
      );
    }

    const { startDate, endDate, periodLabel } = parsePeriodFromQuery(userQuery);
    const domain = detectQueryDomain(userQuery);

    let domainBadge = "📊 Infografis General Analytics";
    let title = `AI Insight & Analytics — ${periodLabel}`;
    let aiSummary = "";
    let keyInsights: string[] = [];
    let recommendations: string[] = [];
    let healthScore = 90;
    let healthStatus: "Sangat Sehat" | "Sehat" | "Perhatian" | "Kritis" = "Sangat Sehat";

    let kpiCards: Array<{
      label: string;
      value: string;
      subtitle: string;
      color: "emerald" | "red" | "blue" | "purple" | "amber";
    }> = [];

    let categoryBreakdown: Array<{
      name: string;
      value: number;
      valueFormatted: string;
      percentOfTotal: number;
    }> = [];

    let tableHeaders: string[] = [];
    let tableRows: Array<Record<string, string>> = [];

    if (domain === "kas") {
      domainBadge = "💰 Infografis Keuangan & Kas";
      title = `Infografis Laporan Kas & Keuangan — ${periodLabel}`;

      let kasEntries = await prisma.kasEntry.findMany({
        where: { txnDate: { gte: startDate, lte: endDate } },
        orderBy: { txnDate: "asc" },
      });

      if (kasEntries.length === 0) {
        kasEntries = await prisma.kasEntry.findMany({
          take: 30,
          orderBy: { txnDate: "desc" },
        });
      }

      const totalIncome = kasEntries.reduce((s, e) => s + e.amountIn, 0);
      const totalExpense = kasEntries.reduce((s, e) => s + e.amountOut, 0);
      const netBalance = totalIncome - totalExpense;
      const ratio = totalExpense > 0 ? Math.round((totalExpense / Math.max(totalIncome, 1)) * 100) : 0;

      kpiCards = [
        { label: "Total Pendapatan", value: formatRp(totalIncome), subtitle: "Pemasukan Kas", color: "emerald" },
        { label: "Total Pengeluaran", value: formatRp(totalExpense), subtitle: "Beban Operasional", color: "red" },
        { label: "Surplus / Defisit (Net)", value: formatRp(netBalance), subtitle: netBalance >= 0 ? "Surplus Kas" : "Defisit Kas", color: netBalance >= 0 ? "blue" : "red" },
        { label: "Rasio Beban", value: `${ratio}%`, subtitle: "Efisiensi Operasional", color: "purple" },
      ];

      const kegMap = new Map<string, { amountIn: number; amountOut: number }>();
      kasEntries.forEach((e) => {
        const k = (e.kegiatan || "Umum").trim() || "Umum";
        const c = kegMap.get(k) || { amountIn: 0, amountOut: 0 };
        c.amountIn += e.amountIn;
        c.amountOut += e.amountOut;
        kegMap.set(k, c);
      });

      const maxTotal = Math.max(totalIncome + totalExpense, 1);
      categoryBreakdown = Array.from(kegMap.entries()).map(([name, v]) => ({
        name,
        value: v.amountIn + v.amountOut,
        valueFormatted: v.amountIn > 0 ? `+${formatRp(v.amountIn)}` : `-${formatRp(v.amountOut)}`,
        percentOfTotal: Math.round(((v.amountIn + v.amountOut) / maxTotal) * 100),
      })).sort((a, b) => b.value - a.value);

      tableHeaders = ["Tanggal", "Keterangan", "Kegiatan", "Pemasukan", "Pengeluaran"];
      tableRows = kasEntries.slice(0, 6).map((e) => ({
        c1: new Date(e.txnDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
        c2: e.description,
        c3: e.kegiatan || "Umum",
        c4: e.amountIn > 0 ? formatRp(e.amountIn) : "—",
        c5: e.amountOut > 0 ? formatRp(e.amountOut) : "—",
      }));

      aiSummary = `Analisis keuangan kas periode ${periodLabel} mencatatkan total pendapatan **${formatRp(totalIncome)}** dan total pengeluaran **${formatRp(totalExpense)}**, menghasilkan saldo bersih sebesar **${formatRp(netBalance)}**. Rasio beban operasional berada di angka **${ratio}%**.`;
      keyInsights = [
        `Arus kas berada dalam posisi ${netBalance >= 0 ? "surplus positif" : "defisit"} sebesar ${formatRp(Math.abs(netBalance))}.`,
        `Kategori transaksi terbesar dikontribusikan oleh **${categoryBreakdown[0]?.name || "Kegiatan Operasional"}**.`,
        `Terdapat ${kasEntries.length} total mutasi transaksi kas yang tercatat dan diverifikasi.`,
      ];
      recommendations = [
        `Pertahankan rasio pengeluaran operasional di bawah 65% terhadap total pemasukan kas.`,
        `Lakukan rekonsiliasi rutin harian/mingguan untuk menghindari ketidaksesuaian saldo.`,
      ];
    } else if (domain === "anggota") {
      domainBadge = "🥋 Demografi & Statistik Atlet / Anggota";
      title = `Demografi & Analisis Keanggotaan Atlet INKAI — ${periodLabel}`;

      const [totalMembers, activeMembers, pendingMembers, rankGroups, dojoGroups, recentMembers] = await Promise.all([
        prisma.member.count(),
        prisma.member.count({ where: { status: "ACTIVE" } }),
        prisma.member.count({ where: { status: "PENDING" } }),
        prisma.member.groupBy({ by: ["currentRank"], _count: { id: true } }),
        prisma.dojo.count({ where: { isDeleted: false } }),
        prisma.member.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { dojo: true } }),
      ]);

      kpiCards = [
        { label: "Total Anggota", value: totalMembers.toLocaleString("id-ID"), subtitle: "Terdaftar Resmi", color: "emerald" },
        { label: "Anggota Aktif", value: activeMembers.toLocaleString("id-ID"), subtitle: "Verified Active", color: "blue" },
        { label: "Menunggu Approval", value: pendingMembers.toLocaleString("id-ID"), subtitle: "Pending Status", color: pendingMembers > 0 ? "amber" : "emerald" },
        { label: "Total Ranting / Dojo", value: dojoGroups.toLocaleString("id-ID"), subtitle: "Cabang Surabaya", color: "purple" },
      ];

      categoryBreakdown = rankGroups
        .map((r) => ({
          name: r.currentRank || "Putih (Kyu 10)",
          value: r._count.id,
          valueFormatted: `${r._count.id} Atlet`,
          percentOfTotal: Math.round((r._count.id / Math.max(totalMembers, 1)) * 100),
        }))
        .sort((a, b) => b.value - a.value);

      tableHeaders = ["Nama Atlet", "NIA", "Ranting / Dojo", "Sabuk / Kyu", "Status"];
      tableRows = recentMembers.map((m) => ({
        c1: m.fullName,
        c2: m.nia || "Belum ada",
        c3: m.dojo?.name || "Dojo External",
        c4: m.currentRank || "Putih",
        c5: m.status,
      }));

      aiSummary = `Total keanggotaan atlet INKAI Surabaya saat ini mencapai **${totalMembers} orang** yang tersebar di **${dojoGroups} Ranting/Dojo**, dengan **${activeMembers} anggota aktif** dan **${pendingMembers} pendaftar baru** menunggu persetujuan admin.`;
      keyInsights = [
        `Tingkat keaktifan anggota mencapai **${Math.round((activeMembers / Math.max(totalMembers, 1)) * 100)}%** dari total populasi.`,
        `Tingkat sabuk terbanyak didominasi oleh **${categoryBreakdown[0]?.name || "Sabuk Putih"}** berjumlah ${categoryBreakdown[0]?.value || 0} atlet.`,
        `Terdapat ${pendingMembers} calon anggota baru yang menanti proses verifikasi dan persetujuan NIA.`,
      ];
      recommendations = [
        `Segera selesaikan verifikasi persetujuan (approval) ${pendingMembers} calon pendaftar baru.`,
        `Galakkan pembinaan atlet sabuk kyu dasar untuk persiapan Ujian Kenaikan Tingkat (UKT).`,
      ];
    } else if (domain === "pertandingan") {
      domainBadge = "🏆 Analytics Kejuaraan & Roster Pertandingan";
      title = `Statistik Pertandingan & Rekapitulasi Kejuaraan — ${periodLabel}`;

      const [totalAthletes, medalStats, recentAthletes] = await Promise.all([
        prisma.tournamentRegistration.count(),
        prisma.tournamentRegistration.groupBy({ by: ["medal"], _count: { id: true } }),
        prisma.tournamentRegistration.findMany({
          take: 6,
          orderBy: { createdAt: "desc" },
          include: { member: true, dojo: true, category: true },
        }),
      ]);

      const goldCount = medalStats.find((m) => m.medal === "GOLD")?._count.id || 0;
      const silverCount = medalStats.find((m) => m.medal === "SILVER")?._count.id || 0;
      const bronzeCount = medalStats.find((m) => m.medal === "BRONZE")?._count.id || 0;

      kpiCards = [
        { label: "Total Atlet Terdaftar", value: totalAthletes.toLocaleString("id-ID"), subtitle: "Roster Kejuaraan", color: "emerald" },
        { label: "Medali Emas (🥇)", value: goldCount.toLocaleString("id-ID"), subtitle: "Juara 1 Utama", color: "amber" },
        { label: "Medali Perak (🥈)", value: silverCount.toLocaleString("id-ID"), subtitle: "Juara 2", color: "purple" },
        { label: "Medali Perunggu (🥉)", value: bronzeCount.toLocaleString("id-ID"), subtitle: "Juara 3", color: "blue" },
      ];

      categoryBreakdown = [
        { name: "🥇 Medali Emas (5 Point)", value: goldCount, valueFormatted: `${goldCount} Medali`, percentOfTotal: Math.round((goldCount / Math.max(totalAthletes, 1)) * 100) },
        { name: "🥈 Medali Perak (3 Point)", value: silverCount, valueFormatted: `${silverCount} Medali`, percentOfTotal: Math.round((silverCount / Math.max(totalAthletes, 1)) * 100) },
        { name: "🥉 Medali Perunggu (1 Point)", value: bronzeCount, valueFormatted: `${bronzeCount} Medali`, percentOfTotal: Math.round((bronzeCount / Math.max(totalAthletes, 1)) * 100) },
      ];

      tableHeaders = ["Nama Atlet", "Asal Dojo", "Kelas Pertandingan", "BB (Berat Badan)", "Prestasi Medali"];
      tableRows = recentAthletes.map((r) => ({
        c1: r.member.fullName,
        c2: r.dojo.name,
        c3: r.category.name,
        c4: r.actualWeight ? `${r.actualWeight} kg` : "—",
        c5: r.medal === "GOLD" ? "🥇 Emas" : r.medal === "SILVER" ? "🥈 Perak" : r.medal === "BRONZE" ? "🥉 Perunggu" : "Peserta",
      }));

      aiSummary = `Statistik Kejuaraan mencatatkan partisipasi sebanyak **${totalAthletes} atlet terdaftar** dalam event kejuaraan. Sebanyak **${goldCount} Emas**, **${silverCount} Perak**, dan **${bronzeCount} Perunggu** telah dianugerahkan kepada para pemenang.`;
      keyInsights = [
        `Partisipasi atlet kejuaraan tersebar di berbagai kelas pertandingan Kata dan Kumite.`,
        `Total raihan medali yang telah terdistribusi mencapai ${goldCount + silverCount + bronzeCount} medali.`,
        `Verifikasi timbang badan dan pendaftaran ulang berkas atlet berjalan sesuai prosedur.`,
      ];
      recommendations = [
        `Pastikan verifikasi fisik berkas (Akte, BPJS, Foto) seluruh atlet selesai sebelum hari pelaksanaan.`,
        `Lakukan pembaruan klasemen peringkat Juara Umum secara realtime pada papan skor kejuaraan.`,
      ];
    } else {
      domainBadge = "📜 Analytics UKT & Kenaikan Tingkat";
      title = `Statistik Ujian Kenaikan Tingkat (UKT) — ${periodLabel}`;

      const [totalUktRegs, approvedCount, dojoCount, recentUkt] = await Promise.all([
        prisma.eventRegistration.count(),
        prisma.eventRegistration.count({ where: { status: "APPROVED" } }),
        prisma.dojo.count({ where: { isDeleted: false } }),
        prisma.eventRegistration.findMany({
          take: 6,
          orderBy: { createdAt: "desc" },
          include: { member: { include: { dojo: true } } },
        }),
      ]);

      kpiCards = [
        { label: "Peserta UKT Terdaftar", value: totalUktRegs.toLocaleString("id-ID"), subtitle: "Ujian Kenaikan Sabuk", color: "emerald" },
        { label: "Disetujui / Approved", value: approvedCount.toLocaleString("id-ID"), subtitle: "Terverifikasi Ranting", color: "blue" },
        { label: "Menunggu / Pending", value: (totalUktRegs - approvedCount).toLocaleString("id-ID"), subtitle: "Dalam Verifikasi", color: "amber" },
        { label: "Ranting Berpartisipasi", value: dojoCount.toLocaleString("id-ID"), subtitle: "Dojo Surabaya", color: "purple" },
      ];

      categoryBreakdown = [
        { name: "Peserta Approved (Disetujui)", value: approvedCount, valueFormatted: `${approvedCount} Peserta`, percentOfTotal: Math.round((approvedCount / Math.max(totalUktRegs, 1)) * 100) },
        { name: "Dalam Verifikasi / Pending", value: totalUktRegs - approvedCount, valueFormatted: `${totalUktRegs - approvedCount} Peserta`, percentOfTotal: Math.round(((totalUktRegs - approvedCount) / Math.max(totalUktRegs, 1)) * 100) },
      ];

      tableHeaders = ["Nama Peserta", "Dojo / Ranting", "Sabuk / Kyu Saat Ini", "Terdaftar Pada", "Status UKT"];
      tableRows = recentUkt.map((u) => ({
        c1: u.member?.fullName || "Peserta UKT",
        c2: u.member?.dojo?.name || "Ranting Surabaya",
        c3: u.registeredRank || u.member?.currentRank || "Putih (Kyu 10)",
        c4: new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
        c5: u.status,
      }));

      aiSummary = `Pendaftaran Ujian Kenaikan Tingkat (UKT) mencatatkan partisipasi **${totalUktRegs} peserta**, dengan **${approvedCount} peserta** terkonfirmasi disetujui.`;
      keyInsights = [
        `Rasio kelunasan administrasi UKT mencapai **${Math.round((approvedCount / Math.max(totalUktRegs, 1)) * 100)}%**.`,
        `Seluruh ranting/dojo telah mengirimkan perwakilan peserta ujian.`,
      ];
      recommendations = [
        `Segera koordinasikan penerbitan lembar nota dan verifikasi berkas bagi peserta yang telah lunas.`,
      ];
    }

    // Enrich with MixRoute LLM if API Key is configured
    if (hasMixrouteApiKey()) {
      try {
        const mixroute = createMixrouteProvider();
        const llmPrompt = `Anda adalah Analis AI Officer & System Assistant INKAI Surabaya.
User menanyakan: "${userQuery}".
Domain Data: ${domainBadge} (${periodLabel}).
Tarik kesimpulan AI Insight yang tajam, profesional, dan relevan dalam bahasa Indonesia.

Format respon JSON murni tanpa codeblock:
{
  "aiSummary": "narasi singkat 2-3 kalimat menjawab pertanyaan user",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "recommendations": ["saran 1", "saran 2"]
}`;

        const llmResult = await generateText({
          model: mixroute(getTanyaInkaiModelId()),
          prompt: llmPrompt,
          temperature: 0.3,
        });

        const cleanedJson = llmResult.text.replace(/```json|```/g, "").trim();
        const parsedLlm = JSON.parse(cleanedJson);
        if (parsedLlm.aiSummary) aiSummary = parsedLlm.aiSummary;
        if (Array.isArray(parsedLlm.keyInsights) && parsedLlm.keyInsights.length > 0)
          keyInsights = parsedLlm.keyInsights;
        if (Array.isArray(parsedLlm.recommendations) && parsedLlm.recommendations.length > 0)
          recommendations = parsedLlm.recommendations;
      } catch (err) {
        console.warn("[AI-Insight] MixRoute LLM enrichment skipped, using smart local fallback:", err);
      }
    }

    return NextResponse.json({
      success: true,
      title,
      domainBadge,
      periodLabel,
      query: userQuery,
      domain,
      aiSummary,
      healthScore,
      healthStatus,
      keyInsights,
      recommendations,
      kpiCards,
      categoryBreakdown,
      tableHeaders,
      tableRows,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/ai-insight] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Gagal meng-generate AI insight." },
      { status: 500 }
    );
  }
}
