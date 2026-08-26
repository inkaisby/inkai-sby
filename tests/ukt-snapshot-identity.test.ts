import { describe, expect, it } from "vitest";
import {
  applyUktRegistrationSnapshotToRows,
  shouldKeepUktRowsOnEmptySnapshot,
  type UktMemberRow,
  type UktRegistrationSnapshotItem,
} from "@/lib/ukt";

function stubRow(partial: Partial<UktMemberRow> & { memberId: string }): UktMemberRow {
  return {
    memberId: partial.memberId,
    registrationId: partial.registrationId ?? null,
    photoUrl: partial.photoUrl ?? null,
    nia: partial.nia ?? null,
    fullName: partial.fullName ?? "Anggota",
    birthPlace: partial.birthPlace ?? null,
    birthDate: partial.birthDate ?? null,
    gender: partial.gender ?? null,
    address: partial.address ?? null,
    kyuLama: partial.kyuLama ?? "Putih",
    kyuBaru: partial.kyuBaru ?? null,
    memberCurrentRank: partial.memberCurrentRank ?? null,
    birthCertificateUrl: partial.birthCertificateUrl ?? null,
    bpjsCardUrl: partial.bpjsCardUrl ?? null,
    dojoName: partial.dojoName ?? "Ranting",
    dojoId: partial.dojoId ?? "d1",
    status: partial.status ?? "BELUM_DAFTAR",
    billingId: partial.billingId ?? null,
    billingStatus: partial.billingStatus ?? null,
    billingAmount: partial.billingAmount ?? null,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendanceCount: 0,
    attendancePct: 0,
    examResult: partial.examResult ?? null,
    examPresent: partial.examPresent ?? null,
  };
}

describe("shouldKeepUktRowsOnEmptySnapshot", () => {
  it("keeps existing registered rows when snapshot is empty", () => {
    expect(shouldKeepUktRowsOnEmptySnapshot(5, 0)).toBe(true);
  });

  it("allows apply when snapshot has participants", () => {
    expect(shouldKeepUktRowsOnEmptySnapshot(5, 3)).toBe(false);
  });

  it("allows apply when table was already empty", () => {
    expect(shouldKeepUktRowsOnEmptySnapshot(0, 0)).toBe(false);
  });
});

describe("applyUktRegistrationSnapshotToRows identity", () => {
  it("appends new participant with Tempat/TTL/JK/Alamat/Foto from snapshot", () => {
    const rows: UktMemberRow[] = [];
    const participants: UktRegistrationSnapshotItem[] = [
      {
        memberId: "m1",
        registrationId: "r1",
        status: "APPROVED",
        kyuLama: "Biru (Kyu 5)",
        kyuBaru: null,
        billingId: "b1",
        billingStatus: "PENDING",
        billingAmount: 315000,
        examResult: null,
        examPresent: null,
        registrationWaiver: null,
        fullName: "Budi",
        nia: "24.1",
        dojoId: "d1",
        dojoName: "GADING",
        photoUrl: "https://example.com/p.jpg",
        birthPlace: "Surabaya",
        birthDate: "2010-01-02T00:00:00.000Z",
        gender: "L",
        address: "Jl. Mawar",
        birthCertificateUrl: "https://example.com/akte.pdf",
        bpjsCardUrl: null,
      },
    ];
    const out = applyUktRegistrationSnapshotToRows(rows, participants);
    expect(out).toHaveLength(1);
    expect(out[0].birthPlace).toBe("Surabaya");
    expect(out[0].birthDate).toBe("2010-01-02T00:00:00.000Z");
    expect(out[0].gender).toBe("L");
    expect(out[0].address).toBe("Jl. Mawar");
    expect(out[0].photoUrl).toBe("https://example.com/p.jpg");
    expect(out[0].birthCertificateUrl).toBe("https://example.com/akte.pdf");
  });

  it("does not wipe existing Tempat when snapshot identity is null", () => {
    const rows = [
      stubRow({
        memberId: "m1",
        registrationId: "r1",
        status: "APPROVED",
        birthPlace: "Surabaya",
        gender: "L",
        address: "Jl. Lama",
        photoUrl: "https://example.com/old.jpg",
      }),
    ];
    const participants: UktRegistrationSnapshotItem[] = [
      {
        memberId: "m1",
        registrationId: "r1",
        status: "APPROVED",
        kyuLama: "Biru (Kyu 5)",
        kyuBaru: "Ungu (Kyu 4)",
        billingId: "b1",
        billingStatus: "PAID",
        billingAmount: 315000,
        examResult: null,
        examPresent: null,
        registrationWaiver: null,
        birthPlace: null,
        birthDate: null,
        gender: null,
        address: null,
        photoUrl: null,
      },
    ];
    const out = applyUktRegistrationSnapshotToRows(rows, participants);
    expect(out[0].birthPlace).toBe("Surabaya");
    expect(out[0].gender).toBe("L");
    expect(out[0].address).toBe("Jl. Lama");
    expect(out[0].photoUrl).toBe("https://example.com/old.jpg");
    expect(out[0].billingStatus).toBe("PAID");
    expect(out[0].kyuBaru).toBe("Ungu (Kyu 4)");
  });

  it("fills blank identity on existing row from snapshot", () => {
    const rows = [
      stubRow({
        memberId: "m1",
        registrationId: "r1",
        status: "APPROVED",
        birthPlace: null,
        gender: null,
      }),
    ];
    const participants: UktRegistrationSnapshotItem[] = [
      {
        memberId: "m1",
        registrationId: "r1",
        status: "APPROVED",
        kyuLama: null,
        kyuBaru: null,
        billingId: null,
        billingStatus: "PENDING",
        billingAmount: null,
        examResult: null,
        examPresent: null,
        registrationWaiver: null,
        birthPlace: "Malang",
        gender: "P",
        address: "Jl. Baru",
      },
    ];
    const out = applyUktRegistrationSnapshotToRows(rows, participants);
    expect(out[0].birthPlace).toBe("Malang");
    expect(out[0].gender).toBe("P");
    expect(out[0].address).toBe("Jl. Baru");
  });
});
