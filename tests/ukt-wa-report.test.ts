import { describe, expect, it } from "vitest";

import {
  buildUktCabangWaReportText,
  buildUktRantingWaReportText,
  countNotaBeltGroups,
  extractUktRankNumber,
  formatRupiahNota,
  formatUktWaBendaharaPaymentLines,
  isUktNotaRow,
  isUktPaymentDocumentRow,
  isUktWaRosterRow,
  resolveUktWaBendaharaPayment,
  sortUktWaRosterByKyu,
  uktWaNetOfNotaRows,
} from "../src/lib/ukt";
import { resolveUktRankColumns, shortRankLabel } from "../src/lib/belt";
import { LATBER_PAYMENT } from "../src/lib/latber";

const beltFees = {
  PUTIH: 285000,
  KUNING: 295000,
  HIJAU: 305000,
  BIRU: 315000,
  COKELAT: 345000,
};

const komisi = 50000;

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
        billingStatus: "PENDING",
        billingId: "b1",
        billingAmount: 295000,
      },
    ] as any[];

    const text = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
    );
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
      "Kuning (Kyu 7) →",
      "Kuning (Kyu 7)",
      "Pendaftaran UKT",
    );
    expect(res.kyuBaru).toBeNull();
  });

  it("shortRankLabel: regex boundary DAN aman", () => {
    const out = shortRankLabel("PENDAN 8");
    expect(out.toLowerCase()).not.toBe("dan 8");
  });

  it("isUktPaymentDocumentRow: Belum Bayar disaring; WA roster tetap masuk", () => {
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
        billingId: "b1",
        billingAmount: 295000,
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
        billingId: "b2",
        billingAmount: 305000,
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
        billingId: "b3",
        billingAmount: 315000,
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

    const roster = rows.filter((r) => isUktWaRosterRow(r));
    expect(roster.map((r) => r.fullName)).toEqual([
      "Belum Bayar",
      "Sudah Ajukan",
      "Lunas",
    ]);

    const text = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      roster,
      beltFees,
      komisi,
    );
    expect(text).toContain("TOTAL SEMUA: 3 peserta");
    expect(text).toContain("*Pelaksanaan UKT Semester II-2026*");
    expect(text).toContain("*1 Ranting*");
    expect(text).toContain("(Lunas: 1 · Belum lunas: 2)");
    expect(text).toContain("*Jumlah UKT:");
    expect(text).not.toContain("List Ranting");
    expect(text).not.toContain("Pelaksaan");
    expect(text).not.toContain("TOTAL disetor");
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
    billingId: "b1",
    billingAmount: 295000,
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
        billingId: "b2",
      },
    ] as any[];
    const examAt = "2026-09-12T01:00:00.000Z";
    const past = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
      {
        examAt,
        now: Date.parse("2026-09-13T00:00:00.000Z"),
      },
    );
    expect(past).toContain("*Pelaksanaan UKT Semester II-2026*");
    expect(past).toContain("WIB");
    expect(past).not.toMatch(/Hari:/);
    expect(past).toContain("(Lunas: 1 · Belum lunas: 1)");
    expect(past).toMatch(/\*Jumlah UKT: Rp .+,-\*/);

    const future = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
      {
        examAt,
        now: Date.parse("2026-09-09T01:00:00.000Z"),
      },
    );
    expect(future).toMatch(/Hari:/);
  });

  it("semua lunas: baris ranting hanya Lunas; pecahan rupiah _Lunas_", () => {
    const rows = [
      {
        ...baseRow,
        billingStatus: "PAID",
      },
      {
        ...baseRow,
        memberId: "m2",
        registrationId: "r2",
        billingId: "b2",
        billingStatus: "PAID",
        dojoName: "FORTRESS",
        dojoId: "d2",
        billingAmount: 305000,
        kyuLama: "Hijau (Kyu 6)",
      },
    ] as any[];
    const text = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
    );
    expect(text).toContain("= _1 peserta_  Lunas");
    expect(text).toContain("_Lunas_");
    expect(text).not.toMatch(/Belum lunas: 0/);
  });

  it("Jumlah UKT = Lunas Rp + Belum lunas Rp", () => {
    const rows = [
      baseRow,
      {
        ...baseRow,
        memberId: "m2",
        registrationId: "r2",
        billingId: "b2",
        billingStatus: "PAID",
      },
    ] as any[];
    const paidNet = uktWaNetOfNotaRows(
      rows.filter((r) => r.billingStatus === "PAID"),
      beltFees,
      komisi,
    );
    const unpaidNet = uktWaNetOfNotaRows(
      rows.filter((r) => r.billingStatus !== "PAID"),
      beltFees,
      komisi,
    );
    const text = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
    );
    expect(text).toContain(`*Jumlah UKT: ${formatRupiahNota(paidNet + unpaidNet)}*`);
    expect(text).toContain(
      `_(Lunas: ${formatRupiahNota(paidNet)} · Belum lunas: ${formatRupiahNota(unpaidNet)})_`,
    );
  });

  it("Dispora: Tempat + Lokasi; string lain hanya Tempat; kosong dihilangkan", () => {
    const rows = [baseRow] as any[];
    const dispora = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
      {
        examLocation: "Prasarana Dojo Karate Dispora Jatim",
      },
    );
    expect(dispora).toContain("*Tempat:* Prasarana Dojo Karate Dispora Jatim");
    expect(dispora).toContain("*Lokasi:*");

    const other = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
      {
        examLocation: "Gedung Serbaguna",
      },
    );
    expect(other).toContain("*Tempat:* Gedung Serbaguna");
    expect(other).not.toContain("*Lokasi:*");

    const empty = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
    );
    expect(empty).not.toContain("*Tempat:*");
    expect(empty).not.toContain("*Lokasi:*");
  });
});

describe("UKT Laporan WA format ranting", () => {
  it("A/B/C + TOTAL (A+B−C) + Sudah lunas / Belum lunas", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        fullName: "BELUM",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Kuning (Kyu 7)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b1",
        billingAmount: 295000,
      },
      {
        memberId: "m2",
        registrationId: "r2",
        fullName: "LUNAS",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Kuning (Kyu 7)",
        status: "APPROVED",
        billingStatus: "PAID",
        billingId: "b2",
        billingAmount: 295000,
      },
    ] as any[];

    const text = buildUktRantingWaReportText(
      "UKT Semester II-2026",
      "GADING",
      rows,
      beltFees,
      komisi,
    );
    expect(text).toContain("*A.* Subtotal A (Biaya UKT):");
    expect(text).toContain("*B.* Subtotal B (Buku Rusak/Hilang): _Rp 0,-_");
    expect(text).toContain("*C.* Komisi Ranting (2 ×");
    expect(text).toContain("*TOTAL (A+B−C):");
    expect(text).toContain("Sudah lunas:");
    expect(text).toContain("Belum lunas:");
    expect(text).toContain("_Termasuk 1 Belum Bayar_");
    expect(text).not.toContain("TOTAL disetor");
    expect(text).not.toContain("yang dibayarkan");
    expect(isUktNotaRow(rows[0])).toBe(true);
    // Jarak enter: sabuk ↔ Termasuk ↔ A/B/C ↔ TOTAL
    expect(text).toMatch(/KUNING:[\s\S]*?\n\n_Termasuk 1 Belum Bayar_\n\n\*A\./);
    expect(text).toMatch(/\*C\.\* Komisi Ranting[\s\S]*?\n\n\*TOTAL \(A\+B/);
  });

  it("semua lunas: pecahan _Sudah lunas_ saja", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        fullName: "LUNAS",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Kuning (Kyu 7)",
        status: "APPROVED",
        billingStatus: "PAID",
        billingId: "b1",
        billingAmount: 295000,
      },
    ] as any[];
    const text = buildUktRantingWaReportText(
      "UKT Semester II-2026",
      "GADING",
      rows,
      beltFees,
      komisi,
    );
    expect(text).toContain("_Sudah lunas_");
    expect(text).not.toContain("Belum lunas:");
  });

  it("rekening bendahara: profil kustom atau fallback Mandiri", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        fullName: "LUNAS",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Kuning (Kyu 7)",
        status: "APPROVED",
        billingStatus: "PAID",
        billingId: "b1",
        billingAmount: 295000,
      },
    ] as any[];

    expect(formatUktWaBendaharaPaymentLines(null)).toEqual([]);
    expect(formatUktWaBendaharaPaymentLines({ bankAccountNumber: "" })).toEqual(
      [],
    );

    const fallback = resolveUktWaBendaharaPayment({});
    expect(fallback.bankAccountNumber).toBe(LATBER_PAYMENT.bankAccountNumber);
    expect(fallback.bankName).toBe(LATBER_PAYMENT.bankName);
    expect(fallback.bankAccountName).toBe(LATBER_PAYMENT.bankAccountName);
    expect(fallback.paymentInstructions).toBe("");

    const custom = resolveUktWaBendaharaPayment({
      bankName: "BCA",
      bankAccountNumber: "1234567890",
      bankAccountName: "INKAI SBY",
    });
    expect(custom.bankAccountNumber).toBe("1234567890");
    expect(custom.bankName).toBe("BCA");

    const withPay = buildUktRantingWaReportText(
      "UKT Semester II-2026",
      "GADING",
      rows,
      beltFees,
      komisi,
      undefined,
      {
        bankName: "Mandiri",
        bankAccountNumber: "1400024546344",
        bankAccountName: "HABIBUR RAHMAN",
        paymentInstructions: "Cantumkan nama ranting di berita transfer.",
      },
    );
    expect(withPay).toContain("*Pembayaran ke rekening Bendahara Cabang*");
    expect(withPay).toContain("Bank Mandiri");
    expect(withPay).toContain("1400024546344 a.n. HABIBUR RAHMAN");
    expect(withPay).toContain("Cantumkan nama ranting di berita transfer.");
    expect(withPay).toMatch(
      /_Sudah lunas_\n\n\*Pembayaran ke rekening Bendahara Cabang\*/,
    );

    const emptyProfile = buildUktRantingWaReportText(
      "UKT Semester II-2026",
      "GADING",
      rows,
      beltFees,
      komisi,
      undefined,
      { bankAccountNumber: "" },
    );
    expect(emptyProfile).toContain("*Pembayaran ke rekening Bendahara Cabang*");
    expect(emptyProfile).toContain(
      `${LATBER_PAYMENT.bankAccountNumber} a.n. ${LATBER_PAYMENT.bankAccountName}`,
    );
    expect(emptyProfile).not.toContain("Transfer Rp45.000");
  });

  it("peserta diurut Kyu 10→1 lalu Dan, lalu nama", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        fullName: "ZULFA",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Biru (Kyu 4)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b1",
        billingAmount: 315000,
      },
      {
        memberId: "m2",
        registrationId: "r2",
        fullName: "ANDI",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Putih (Kyu 10)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b2",
        billingAmount: 285000,
      },
      {
        memberId: "m3",
        registrationId: "r3",
        fullName: "BUDI",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Hitam (DAN 6)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b3",
        billingAmount: 345000,
      },
      {
        memberId: "m4",
        registrationId: "r4",
        fullName: "CITRA",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Putih (Kyu 10)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b4",
        billingAmount: 285000,
      },
    ] as any[];

    const sorted = sortUktWaRosterByKyu(rows);
    expect(sorted.map((r) => r.fullName)).toEqual([
      "ANDI",
      "CITRA",
      "ZULFA",
      "BUDI",
    ]);

    const text = buildUktRantingWaReportText(
      "UKT Semester II-2026",
      "GADING",
      rows,
      beltFees,
      komisi,
    );
    const idxAndi = text.indexOf("1. ANDI");
    const idxCitra = text.indexOf("2. CITRA");
    const idxZulfa = text.indexOf("3. ZULFA");
    const idxBudi = text.indexOf("4. BUDI");
    expect(idxAndi).toBeGreaterThan(-1);
    expect(idxCitra).toBeGreaterThan(idxAndi);
    expect(idxZulfa).toBeGreaterThan(idxCitra);
    expect(idxBudi).toBeGreaterThan(idxZulfa);
  });

  it("komisi C mengikuti jumlah peserta roster, bukan hanya baris nota", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        fullName: "DENGAN TAGIHAN",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Kuning (Kyu 7)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b1",
        billingAmount: 295000,
      },
      {
        memberId: "m2",
        registrationId: "r2",
        fullName: "TANPA TAGIHAN",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Putih (Kyu 10)",
        status: "PENDING",
        selfRegistration: true,
        billingId: null,
        billingAmount: null,
        billingStatus: null,
      },
    ] as any[];

    expect(isUktNotaRow(rows[0])).toBe(true);
    expect(isUktNotaRow(rows[1])).toBe(false);
    expect(isUktWaRosterRow(rows[0])).toBe(true);
    expect(isUktWaRosterRow(rows[1])).toBe(true);

    const text = buildUktRantingWaReportText(
      "UKT Semester II-2026",
      "GADING",
      rows,
      beltFees,
      komisi,
    );
    expect(text).toContain("*C.* Komisi Ranting (2 ×");
    expect(text).toContain(`- ${formatRupiahNota(2 * komisi)}`);
    expect(text).not.toContain("*C.* Komisi Ranting (1 ×");
    expect(text).toContain(
      `PUTIH: 1 × ${formatRupiahNota(285000)} = ${formatRupiahNota(285000)}`,
    );
    expect(text).toContain(
      `KUNING: 1 × ${formatRupiahNota(295000)} = ${formatRupiahNota(295000)}`,
    );
    const subtotalA = 285000 + 295000;
    const total = subtotalA - 2 * komisi;
    expect(text).toContain(
      `*A.* Subtotal A (Biaya UKT): _${formatRupiahNota(subtotalA)}_`,
    );
    expect(text).toContain(`*TOTAL (A+B−C): ${formatRupiahNota(total)}*`);
    expect(text).toContain(`_Termasuk 2 Belum Bayar_`);
    expect(text).toContain(
      `_(Sudah lunas: ${formatRupiahNota(0)} · Belum lunas: ${formatRupiahNota(total)})_`,
    );
  });

  it("4 Hijau: 1 tanpa tagihan tetap masuk HIJAU 4× snapshot", () => {
    const rows = [
      {
        memberId: "h1",
        registrationId: "r1",
        fullName: "HIJAU SATU",
        dojoId: "d1",
        dojoName: "JAMBANGAN",
        kyuLama: "Hijau (Kyu 6)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b1",
        billingAmount: 305000,
      },
      {
        memberId: "h2",
        registrationId: "r2",
        fullName: "HIJAU DUA",
        dojoId: "d1",
        dojoName: "JAMBANGAN",
        kyuLama: "Hijau (Kyu 6)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b2",
        billingAmount: 305000,
      },
      {
        memberId: "h3",
        registrationId: "r3",
        fullName: "HIJAU TIGA",
        dojoId: "d1",
        dojoName: "JAMBANGAN",
        kyuLama: "Hijau (Kyu 6)",
        status: "APPROVED",
        billingStatus: "PENDING",
        billingId: "b3",
        billingAmount: 305000,
      },
      {
        memberId: "h4",
        registrationId: "r4",
        fullName: "HIJAU EMPAT",
        dojoId: "d1",
        dojoName: "JAMBANGAN",
        kyuLama: "Hijau (Kyu 6)",
        status: "APPROVED",
        billingId: null,
        billingAmount: null,
        billingStatus: null,
      },
    ] as any[];

    expect(rows.filter((r) => isUktNotaRow(r))).toHaveLength(3);

    const text = buildUktRantingWaReportText(
      "UKT Semester II-2026",
      "JAMBANGAN",
      rows,
      beltFees,
      komisi,
    );
    expect(text).toContain(
      `HIJAU: 4 × ${formatRupiahNota(305000)} = ${formatRupiahNota(4 * 305000)}`,
    );
    expect(text).not.toContain("HIJAU: 3 ×");
    const subtotalA = 4 * 305000;
    const total = subtotalA - 4 * komisi;
    expect(text).toContain(
      `*A.* Subtotal A (Biaya UKT): _${formatRupiahNota(subtotalA)}_`,
    );
    expect(text).toContain(`*TOTAL (A+B−C): ${formatRupiahNota(total)}*`);
    expect(text).toContain(`_Termasuk 4 Belum Bayar_`);
    expect(text).toContain(
      `_(Sudah lunas: ${formatRupiahNota(0)} · Belum lunas: ${formatRupiahNota(total)})_`,
    );

    const cabang = buildUktCabangWaReportText(
      "UKT Semester II-2026",
      rows,
      beltFees,
      komisi,
    );
    expect(cabang).toContain(
      `*Jumlah UKT: ${formatRupiahNota(total)}*`,
    );
    expect(cabang).toContain(
      `_(Lunas: ${formatRupiahNota(0)} · Belum lunas: ${formatRupiahNota(total)})_`,
    );
  });

  it("uktWaNetOfNotaRows: rows tanpa tagihan ikut dihitung (tanpa re-filter nota)", () => {
    const rows = [
      {
        memberId: "m1",
        registrationId: "r1",
        fullName: "A",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "Hijau (Kyu 6)",
        status: "APPROVED",
        billingId: null,
        billingAmount: null,
        billingStatus: null,
      },
    ] as any[];
    expect(isUktNotaRow(rows[0])).toBe(false);
    expect(uktWaNetOfNotaRows(rows, beltFees, komisi)).toBe(305000 - komisi);
  });
});
