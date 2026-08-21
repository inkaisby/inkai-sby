import { describe, expect, it } from "vitest";

import {
  canCabangVerifyUktPayment,
  canRantingCancelUkt,
  canRantingSubmitUktPayment,
  isUktNotaRow,
  isUktPaymentDocumentRow,
  resolveUktDisplayStatus,
  type UktMemberRow,
} from "../src/lib/ukt";

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
    dojoName: "GADING",
    dojoId: "d1",
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

describe("UKT reset setelah Hapus tagihan", () => {
  it("Menunggu Ujian (lunas) tidak bisa Bayar UKT / batal ranting", () => {
    const paid = row({ billingStatus: "PAID" });
    expect(resolveUktDisplayStatus(paid)).toBe("menunggu_ujian");
    expect(canRantingSubmitUktPayment(paid)).toBe(false);
    expect(canRantingCancelUkt(paid)).toBe(false);
    expect(canCabangVerifyUktPayment(paid)).toBe(false);
  });

  it("setelah reset ke Belum Bayar + billing PENDING, ranting bisa Bayar UKT dan Batal", () => {
    const reset = row({
      billingId: "b2",
      billingStatus: "PENDING",
      status: "APPROVED",
    });
    expect(resolveUktDisplayStatus(reset)).toBe("belum_bayar");
    expect(canRantingSubmitUktPayment(reset)).toBe(true);
    expect(canRantingCancelUkt(reset)).toBe(true);
    expect(canCabangVerifyUktPayment(reset)).toBe(true);
  });

  it("tanpa billingId ranting tidak melihat Bayar UKT", () => {
    const missing = row({ billingId: null, billingStatus: null });
    expect(resolveUktDisplayStatus(missing)).toBe("belum_bayar");
    expect(canRantingSubmitUktPayment(missing)).toBe(false);
  });

  it("setelah ranting Bayar UKT, cabang Verifikasi", () => {
    const waiting = row({ billingStatus: "WAITING_VERIFICATION" });
    expect(resolveUktDisplayStatus(waiting)).toBe("menunggu_verifikasi");
    expect(canRantingSubmitUktPayment(waiting)).toBe(false);
    expect(canCabangVerifyUktPayment(waiting)).toBe(true);
    expect(canRantingCancelUkt(waiting)).toBe(true);
  });
});

describe("isUktPaymentDocumentRow (Laporan WA setor)", () => {
  it("Belum Bayar tidak masuk WA setor", () => {
    expect(isUktPaymentDocumentRow(row({ billingStatus: "PENDING" }))).toBe(
      false,
    );
  });

  it("Menunggu Verifikasi dan Menunggu Ujian masuk", () => {
    expect(
      isUktPaymentDocumentRow(row({ billingStatus: "WAITING_VERIFICATION" })),
    ).toBe(true);
    expect(isUktPaymentDocumentRow(row({ billingStatus: "PAID" }))).toBe(true);
  });

  it("Hapus pendaftaran (tanpa registrationId) tidak masuk", () => {
    expect(
      isUktPaymentDocumentRow(
        row({ registrationId: null, billingId: null, billingStatus: null }),
      ),
    ).toBe(false);
  });

  it("isUktNotaRow: Belum Bayar masuk nota", () => {
    expect(isUktNotaRow(row({ billingStatus: "PENDING" }))).toBe(true);
  });
});
