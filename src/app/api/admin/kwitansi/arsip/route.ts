import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  try {
    const rows = await prisma.kwitansiArsip.findMany({
      orderBy: { createdAt: "desc" },
    });

    const items = rows.map((r) => ({
      id: r.id,
      no: r.no,
      periodeNama: r.periodeNama,
      jenis: r.jenis,
      tanggal: r.tanggal,
      terimaDari: r.terimaDari,
      total: r.total,
      scope: r.scope,
      untukPembayaran: r.untukPembayaran,
      penerimaName: r.penerimaName,
      penyetorName: r.penyetorName,
      penerimaSignUrl: r.penerimaSignUrl,
      penyetorSignUrl: r.penyetorSignUrl,
      notaItems: r.notaItems,
      penerima: r.penerima,
      pajakPersen: r.pajakPersen,
      bidangUjianName: r.bidangUjianName,
      bendaharaName: r.bendaharaName,
      bidangUjianSignUrl: r.bidangUjianSignUrl,
      bendaharaSignUrl: r.bendaharaSignUrl,
      kasSyncMode: r.kasSyncMode as "in" | "out" | "none",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Gagal memuat arsip";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();

    // Support batch sync / migration: { items: [...] }
    if (Array.isArray(body.items)) {
      const results = [];
      for (const item of body.items) {
        if (!item || !item.no) continue;
        const upserted = await prisma.kwitansiArsip.upsert({
          where: { no: String(item.no).trim() },
          create: {
            id: item.id && typeof item.id === "string" ? item.id : undefined,
            no: String(item.no).trim(),
            periodeNama: item.periodeNama || "",
            jenis: item.jenis || "Iuran/tagihan",
            tanggal: item.tanggal || "",
            terimaDari: item.terimaDari || "",
            total: Math.round(Number(item.total) || 0),
            scope: item.scope || "Cabang Surabaya",
            untukPembayaran: item.untukPembayaran || "",
            penerimaName: item.penerimaName || "",
            penyetorName: item.penyetorName || "",
            penerimaSignUrl: item.penerimaSignUrl || null,
            penyetorSignUrl: item.penyetorSignUrl || null,
            notaItems: item.notaItems || null,
            penerima: item.penerima || null,
            pajakPersen: item.pajakPersen ?? 0,
            bidangUjianName: item.bidangUjianName || null,
            bendaharaName: item.bendaharaName || null,
            bidangUjianSignUrl: item.bidangUjianSignUrl || null,
            bendaharaSignUrl: item.bendaharaSignUrl || null,
            kasSyncMode: item.kasSyncMode || "none",
            createdById: authResult.user.id,
          },
          update: {
            periodeNama: item.periodeNama || "",
            jenis: item.jenis || "Iuran/tagihan",
            tanggal: item.tanggal || "",
            terimaDari: item.terimaDari || "",
            total: Math.round(Number(item.total) || 0),
            scope: item.scope || "Cabang Surabaya",
            untukPembayaran: item.untukPembayaran || "",
            penerimaName: item.penerimaName || "",
            penyetorName: item.penyetorName || "",
            penerimaSignUrl: item.penerimaSignUrl || null,
            penyetorSignUrl: item.penyetorSignUrl || null,
            notaItems: item.notaItems || null,
            penerima: item.penerima || null,
            pajakPersen: item.pajakPersen ?? 0,
            bidangUjianName: item.bidangUjianName || null,
            bendaharaName: item.bendaharaName || null,
            bidangUjianSignUrl: item.bidangUjianSignUrl || null,
            bendaharaSignUrl: item.bendaharaSignUrl || null,
            kasSyncMode: item.kasSyncMode || "none",
          },
        });
        results.push(upserted);
      }
      return NextResponse.json({ success: true, count: results.length });
    }

    // Single item upsert
    if (!body || !body.no) {
      return NextResponse.json(
        { error: "Nomor kwitansi/nota (no) wajib diisi" },
        { status: 400 },
      );
    }

    const item = await prisma.kwitansiArsip.upsert({
      where: { no: String(body.no).trim() },
      create: {
        id: body.id && typeof body.id === "string" ? body.id : undefined,
        no: String(body.no).trim(),
        periodeNama: body.periodeNama || "",
        jenis: body.jenis || "Iuran/tagihan",
        tanggal: body.tanggal || "",
        terimaDari: body.terimaDari || "",
        total: Math.round(Number(body.total) || 0),
        scope: body.scope || "Cabang Surabaya",
        untukPembayaran: body.untukPembayaran || "",
        penerimaName: body.penerimaName || "",
        penyetorName: body.penyetorName || "",
        penerimaSignUrl: body.penerimaSignUrl || null,
        penyetorSignUrl: body.penyetorSignUrl || null,
        notaItems: body.notaItems || null,
        penerima: body.penerima || null,
        pajakPersen: body.pajakPersen ?? 0,
        bidangUjianName: body.bidangUjianName || null,
        bendaharaName: body.bendaharaName || null,
        bidangUjianSignUrl: body.bidangUjianSignUrl || null,
        bendaharaSignUrl: body.bendaharaSignUrl || null,
        kasSyncMode: body.kasSyncMode || "none",
        createdById: authResult.user.id,
      },
      update: {
        periodeNama: body.periodeNama || "",
        jenis: body.jenis || "Iuran/tagihan",
        tanggal: body.tanggal || "",
        terimaDari: body.terimaDari || "",
        total: Math.round(Number(body.total) || 0),
        scope: body.scope || "Cabang Surabaya",
        untukPembayaran: body.untukPembayaran || "",
        penerimaName: body.penerimaName || "",
        penyetorName: body.penyetorName || "",
        penerimaSignUrl: body.penerimaSignUrl || null,
        penyetorSignUrl: body.penyetorSignUrl || null,
        notaItems: body.notaItems || null,
        penerima: body.penerima || null,
        pajakPersen: body.pajakPersen ?? 0,
        bidangUjianName: body.bidangUjianName || null,
        bendaharaName: body.bendaharaName || null,
        bidangUjianSignUrl: body.bidangUjianSignUrl || null,
        bendaharaSignUrl: body.bendaharaSignUrl || null,
        kasSyncMode: body.kasSyncMode || "none",
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Gagal menyimpan arsip";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const no = url.searchParams.get("no");

    if (!id && !no) {
      return NextResponse.json(
        { error: "Parameter id atau no wajib diisi" },
        { status: 400 },
      );
    }

    if (id) {
      await prisma.kwitansiArsip.deleteMany({ where: { id } });
    } else if (no) {
      await prisma.kwitansiArsip.deleteMany({ where: { no } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Gagal menghapus arsip";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
