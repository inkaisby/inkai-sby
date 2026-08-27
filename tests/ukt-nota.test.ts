import { describe, expect, it } from "vitest";

import { getBeltGroup } from "../src/lib/belt";
import {
  buildNotaBeltLines,
  buildUktDepositReconciliation,
  isUktNotaRow,
  isUktPaymentDocumentRow,
  rowMatchesNotaDojoSelection,
  type UktMemberRow,
} from "../src/lib/ukt";

const beltFees = {
  PUTIH: 285000,
  KUNING: 295000,
  HIJAU: 305000,
  BIRU: 315000,
  COKELAT: 345000,
};

function row(partial: Partial<UktMemberRow>): UktMemberRow {
  return {
    memberId: "m1",
    registrationId: "r1",
    photoUrl: null,
    nia: null,
    fullName: "Peserta A",
    birthPlace: null,
    birthDate: null,
    gender: null,
    address: null,
    kyuLama: "Kuning (Kyu 7)",
    kyuBaru: null,
    birthCertificateUrl: null,
    bpjsCardUrl: null,
    dojoName: "FORTRESS",
    dojoId: "d-fortress",
    status: "APPROVED",
    billingId: "b1",
    billingStatus: "PENDING",
    billingAmount: 295000,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendancePct: null,
    attendanceCount: 0,
    examResult: null,
    examPresent: null,
    ...partial,
  };
}

describe("isUktNotaRow vs isUktPaymentDocumentRow", () => {
  it("PENDING masuk nota, tidak masuk WA setor", () => {
    const pending = row({ billingStatus: "PENDING" });
    expect(isUktNotaRow(pending)).toBe(true);
    expect(isUktPaymentDocumentRow(pending)).toBe(false);
  });

  it("WAITING_VERIFICATION dan PAID masuk keduanya", () => {
    expect(
      isUktNotaRow(row({ billingStatus: "WAITING_VERIFICATION" })),
    ).toBe(true);
    expect(isUktNotaRow(row({ billingStatus: "PAID" }))).toBe(true);
  });

  it("daftar mandiri PENDING tanpa tagihan tidak masuk nota", () => {
    expect(
      isUktNotaRow(
        row({
          status: "PENDING",
          selfRegistration: true,
          billingId: null,
          billingStatus: null,
          billingAmount: null,
        }),
      ),
    ).toBe(false);
  });
});

describe("buildNotaBeltLines", () => {
  it("FORTRESS-like: Belum Bayar + Biru 315k masuk; Subtotal A = sum billingAmount", () => {
    const rows = [
      row({
        memberId: "1",
        kyuLama: "Putih (Kyu 10)",
        billingAmount: 285000,
        billingStatus: "WAITING_VERIFICATION",
      }),
      row({
        memberId: "2",
        kyuLama: "Putih (Kyu 9)",
        billingAmount: 285000,
        billingStatus: "WAITING_VERIFICATION",
      }),
      row({
        memberId: "3",
        kyuLama: "Kuning (Kyu 7)",
        billingAmount: 295000,
        billingStatus: "WAITING_VERIFICATION",
      }),
      row({
        memberId: "4",
        kyuLama: "Kuning (Kyu 7)",
        billingAmount: 295000,
        billingStatus: "WAITING_VERIFICATION",
      }),
      row({
        memberId: "5",
        kyuLama: "Kuning (Kyu 8)",
        billingAmount: 295000,
        billingStatus: "PENDING",
      }),
      row({
        memberId: "6",
        kyuLama: "Hijau (Kyu 6)",
        billingAmount: 305000,
        billingStatus: "WAITING_VERIFICATION",
      }),
      row({
        memberId: "7",
        kyuLama: "Hijau (Kyu 6)",
        billingAmount: 305000,
        billingStatus: "WAITING_VERIFICATION",
      }),
      row({
        memberId: "8",
        kyuLama: "Biru (Kyu 5)",
        billingAmount: 315000,
        billingStatus: "PENDING",
      }),
    ];

    const notaRows = rows.filter((r) => isUktNotaRow(r));
    expect(notaRows).toHaveLength(8);

    const built = buildNotaBeltLines(notaRows, beltFees);
    expect(built.registeredCount).toBe(8);
    expect(built.subtotalA).toBe(
      285000 * 2 + 295000 * 3 + 305000 * 2 + 315000,
    );
    expect(built.unpaidCount).toBe(2);
    expect(built.unpaidAmount).toBe(295000 + 315000);

    const biru = built.lines.find((l) => l.belt === "BIRU");
    expect(biru).toEqual({
      belt: "BIRU",
      count: 1,
      unitFee: 315000,
      subtotal: 315000,
    });
  });

  it("satu sabuk nominal campur → pecah baris", () => {
    const rows = [
      row({
        memberId: "a",
        kyuLama: "Kuning (Kyu 7)",
        billingAmount: 295000,
      }),
      row({
        memberId: "b",
        kyuLama: "Kuning (Kyu 7)",
        billingAmount: 300000,
      }),
    ];
    const built = buildNotaBeltLines(rows, beltFees);
    expect(built.lines.filter((l) => l.belt === "KUNING")).toHaveLength(2);
    expect(built.subtotalA).toBe(595000);
  });

  it("billingAmount null → fallback tarif snapshot", () => {
    const rows = [
      row({
        kyuLama: "Biru (Kyu 5)",
        billingAmount: null,
        billingStatus: "PENDING",
      }),
    ];
    const built = buildNotaBeltLines(rows, beltFees);
    expect(built.lines[0]).toMatchObject({
      belt: "BIRU",
      unitFee: 315000,
      subtotal: 315000,
    });
    expect(built.subtotalA).toBe(315000);
  });

  it("sabuk LAINNYA tetap masuk Subtotal A", () => {
    const rows = [
      row({
        kyuLama: "Hitam (DAN 1)",
        billingAmount: 400000,
        billingStatus: "PENDING",
      }),
    ];
    const built = buildNotaBeltLines(rows, beltFees);
    expect(built.lines[0]?.belt).toBe("LAINNYA");
    expect(built.subtotalA).toBe(400000);
  });

  it("Gabungan 2 ranting menjumlahkan semua", () => {
    const rows = [
      row({
        memberId: "f1",
        dojoId: "d1",
        dojoName: "FORTRESS",
        billingAmount: 285000,
        kyuLama: "Putih (Kyu 10)",
      }),
      row({
        memberId: "g1",
        dojoId: "d2",
        dojoName: "GADING",
        billingAmount: 295000,
        kyuLama: "Kuning (Kyu 7)",
      }),
    ];
    const built = buildNotaBeltLines(rows, beltFees);
    expect(built.registeredCount).toBe(2);
    expect(built.subtotalA).toBe(580000);
  });
});

describe("rowMatchesNotaDojoSelection", () => {
  it("fallback nama bila dojoId kosong", () => {
    const r = row({ dojoId: "", dojoName: "FORTRESS" });
    const opts = [{ id: "d-fortress", name: "FORTRESS" }];
    expect(
      rowMatchesNotaDojoSelection(r, new Set(["d-fortress"]), opts),
    ).toBe(true);
  });
});

describe("getBeltGroup cokelat", () => {
  it("mengenali Cokelat dan Coklat", () => {
    expect(getBeltGroup("Cokelat (Kyu 3)")).toBe("COKELAT");
    expect(getBeltGroup("Coklat (Kyu 2)")).toBe("COKELAT");
  });
});

describe("buildUktDepositReconciliation total tagihan net", () => {
  it("Total tagihan rekonsiliasi harus sama dengan TOTAL Nota Pembayaran UKT (Subtotal A - Komisi Ranting)", () => {
    const dojos = [{ id: "d-fortress", name: "FORTRESS" }];
    // 11 peserta Fortress lunas
    const rows = [
      // 2 Putih @ 285k
      row({ dojoId: "d-fortress", billingAmount: 285000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-fortress", billingAmount: 285000, billingStatus: "PAID", status: "APPROVED" }),
      // 5 Kuning @ 295k
      row({ dojoId: "d-fortress", billingAmount: 295000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-fortress", billingAmount: 295000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-fortress", billingAmount: 295000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-fortress", billingAmount: 295000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-fortress", billingAmount: 295000, billingStatus: "PAID", status: "APPROVED" }),
      // 3 Hijau @ 305k
      row({ dojoId: "d-fortress", billingAmount: 305000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-fortress", billingAmount: 305000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-fortress", billingAmount: 305000, billingStatus: "PAID", status: "APPROVED" }),
      // 1 Biru @ 315k
      row({ dojoId: "d-fortress", billingAmount: 315000, billingStatus: "PAID", status: "APPROVED" }),
    ];

    const recon = buildUktDepositReconciliation(rows, dojos, {}, 50000);
    expect(recon).toHaveLength(1);
    expect(recon[0]).toMatchObject({
      dojoName: "FORTRESS",
      participantCount: 11,
      paidCount: 11,
      expectedAmount: 2725000, // 3.275.000 (Subtotal A) - 550.000 (11 x 50k komisi) = 2.725.000
      gapLabel: "Belum Bayar: 0, Menunggu Ujian: 11",
    });
  });

  it("gapLabel menampilkan Belum Bayar vs Menunggu Ujian dari Peserta/Lunas", () => {
    const dojos = [{ id: "d-gading", name: "GADING" }];
    const rows = [
      row({ dojoId: "d-gading", billingAmount: 285000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-gading", billingAmount: 285000, billingStatus: "PAID", status: "APPROVED" }),
      row({ dojoId: "d-gading", billingAmount: 285000, billingStatus: "PENDING", status: "APPROVED" }),
      row({ dojoId: "d-gading", billingAmount: 285000, billingStatus: "PENDING", status: "APPROVED" }),
      row({ dojoId: "d-gading", billingAmount: 285000, billingStatus: "PENDING", status: "APPROVED" }),
    ];
    const recon = buildUktDepositReconciliation(rows, dojos, {
      "d-gading": { status: "PENDING" },
    });
    expect(recon[0]).toMatchObject({
      participantCount: 5,
      paidCount: 2,
      gapLabel: "Belum Bayar: 3, Menunggu Ujian: 2",
      depositStatus: "PENDING",
    });
  });

  it("gapLabel zero paid tetap format hitungan (bukan teks Belum ada pembayaran)", () => {
    const dojos = [{ id: "d-x", name: "X" }];
    const rows = [
      row({ dojoId: "d-x", billingAmount: 285000, billingStatus: "PENDING", status: "APPROVED" }),
    ];
    const recon = buildUktDepositReconciliation(rows, dojos, {
      "d-x": { status: "RECEIVED" },
    });
    expect(recon[0].gapLabel).toBe("Belum Bayar: 1, Menunggu Ujian: 0");
    expect(recon[0].depositStatus).toBe("RECEIVED");
  });
});
