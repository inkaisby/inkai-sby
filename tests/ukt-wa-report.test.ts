import { describe, expect, it } from "vitest";

import {
  buildUktCabangWaReportText,
  countNotaBeltGroups,
  extractUktRankNumber,
  isUktPaymentDocumentRow,
} from "../src/lib/ukt";
import { resolveUktRankColumns, shortRankLabel } from "../src/lib/belt";

const beltFees = {
  PUTIH: 285000,
  KUNING: 295000,
  HIJAU: 305000,
  BIRU: 315000,
  COKELAT: 345000,
};

describe("ukt WA/nota sabuk", () => {
  it("WA cabang: kyuBaru DAN 8 tidak membuat bucket dan 8", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        fullName: "Peserta A",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Kuning (Kyu 7)",
        kyuBaru: "Hitam (DAN 8)",
        status: "APPROVED",
      },
    ] as any[];

    const text = buildUktCabangWaReportText("UKT Semester II-2026", rows);
    expect(text.toLowerCase()).toContain("kyu 7 = _1 peserta_");
    expect(text.toLowerCase()).not.toContain("dan 8");
  });

  it("countNotaBeltGroups: kyuBaru berbeda warna tidak menggeser dari billing", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Kuning (Kyu 7)",
        // Ini target setelah ujian (bisa beda warna), harus TIDAK mengotori kelompok nota.
        kyuBaru: "Biru (Kyu 4)",
        billingAmount: 295000,
      },
    ] as any[];

    const counts = countNotaBeltGroups(rows, beltFees);
    expect(counts.KUNING).toBe(1);
    expect(counts.BIRU).toBe(0);
  });

  it("extractUktRankNumber: mencegah false positive substring 'PENDAN 8'", () => {
    expect(extractUktRankNumber("PENDAN 8")).toBe("");
    expect(extractUktRankNumber("dan 8")).toBe("8");
  });
});

describe("resolveUktRankColumns guard categoryName", () => {
  it("categoryName 'Pendaftaran UKT' tidak masuk sebagai kyuBaru", () => {
    const res = resolveUktRankColumns(
      // Pakai separator "→" karena `decodeUktRegisteredRank` memang men-support
      // kasus "lama-only" saat delimiter ada tanpa trailing part.
      "Kuning (Kyu 7) →",
      "Kuning (Kyu 7)",
      "Pendaftaran UKT",
    );
    expect(res.kyuBaru).toBeNull();
  });

  it("shortRankLabel: regex boundary DAN aman", () => {
    const out = shortRankLabel("PENDAN 8");
    // Harus tidak di-normalisasi jadi "Dan 8".
    expect(out.toLowerCase()).not.toBe("dan 8");
  });

  it("Laporan WA setor: Belum Bayar disaring, Menunggu Verifikasi/lunas masuk", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        fullName: "Belum Bayar",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Kuning (Kyu 7)",
        status: "APPROVED",
        billingStatus: "PENDING",
      },
      {
        memberId: "m2",
        registrationId: "r2",
        fullName: "Sudah Ajukan",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Hijau (Kyu 6)",
        status: "APPROVED",
        billingStatus: "WAITING_VERIFICATION",
      },
      {
        memberId: "m3",
        registrationId: "r3",
        fullName: "Lunas",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Biru (Kyu 5)",
        status: "APPROVED",
        billingStatus: "PAID",
      },
      {
        memberId: "m4",
        registrationId: null,
        fullName: "Dihapus",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Putih (Kyu 10)",
        status: "BELUM_DAFTAR",
        billingStatus: null,
      },
    ] as any[];

    const paymentRows = rows.filter((r) => isUktPaymentDocumentRow(r));
    expect(paymentRows.map((r) => r.fullName)).toEqual(["Sudah Ajukan", "Lunas"]);
    const text = buildUktCabangWaReportText("UKT Semester II-2026", paymentRows);
    expect(text).toContain("TOTAL SEMUA: 2 peserta");
    expect(text).toContain("*Pelaksanaan UKT Semester II-2026*");
    expect(text).toContain("*1 Ranting*");
    expect(text).toContain("Lunas: 1 · Belum lunas: 1");
    expect(text.toLowerCase()).not.toContain("belum bayar");
    expect(text).not.toContain("List Ranting");
    expect(text).not.toContain("Pelaksaan");
  });
});

describe("UKT Laporan WA format cabang", () => {
  const baseRow = {
    memberId: "m1",
    registrationId: "r1",
    fullName: "Peserta A",
    dojoId: "d1",
    dojoName: "GADING",
    kyuLama: "Kuning (Kyu 7)",
    status: "APPROVED",
    billingStatus: "WAITING_VERIFICATION",
  };

  it("judul Pelaksanaan, pecahan lunas, tanpa countdown jika ujian lampau", () => {
    const rows = [
      baseRow,
      {
        ...baseRow,
        memberId: "m2",
        registrationId: "r2",
        fullName: "Peserta B",
        billingStatus: "PAID",
      },
    ] as any[];
    const examAt = "2026-09-12T01:00:00.000Z";
    const past = buildUktCabangWaReportText("UKT Semester II-2026", rows, {
      examAt,
      now: Date.parse("2026-09-13T00:00:00.000Z"),
    });
    expect(past).toContain("*Pelaksanaan UKT Semester II-2026*");
    expect(past).toContain("WIB");
    expect(past).not.toMatch(/Hari:/);
    expect(past).toContain("Lunas: 1 · Belum lunas: 1");

    const future = buildUktCabangWaReportText("UKT Semester II-2026", rows, {
      examAt,
      now: Date.parse("2026-09-09T01:00:00.000Z"),
    });
    expect(future).toMatch(/Hari:/);
  });

  it("Dispora: Tempat + Lokasi; string lain hanya Tempat; kosong dihilangkan", () => {
    const rows = [baseRow] as any[];
    const dispora = buildUktCabangWaReportText("UKT Semester II-2026", rows, {
      examLocation: "Prasarana Dojo Karate Dispora Jatim",
    });
    expect(dispora).toContain("*Tempat:* Prasarana Dojo Karate Dispora Jatim");
    expect(dispora).toContain("*Lokasi:*");

    const other = buildUktCabangWaReportText("UKT Semester II-2026", rows, {
      examLocation: "Gedung Serbaguna",
    });
    expect(other).toContain("*Tempat:* Gedung Serbaguna");
    expect(other).not.toContain("*Lokasi:*");

    const empty = buildUktCabangWaReportText("UKT Semester II-2026", rows);
    expect(empty).not.toContain("*Tempat:*");
    expect(empty).not.toContain("*Lokasi:*");
  });
});

