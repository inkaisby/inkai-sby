import { describe, expect, it } from "vitest";

import type { UktMemberRow } from "../src/lib/ukt";
import {
  buildUktHasilUjianFilename,
  buildUktHasilUjianRecapRows,
  countUktHasilUjianRanting,
  countUktHasilUjianSabuk,
  formatUktHasilUjianTtl,
  hasUktHasilUjianRecap,
  resolveUktHasilUjianLastNia,
  sabukLabelFromKyuBaru,
} from "../src/lib/ukt";

function row(partial: Partial<UktMemberRow> & Pick<UktMemberRow, "memberId" | "fullName">): UktMemberRow {
  return {
    registrationId: partial.registrationId ?? `reg-${partial.memberId}`,
    photoUrl: null,
    nia: partial.nia ?? null,
    birthPlace: partial.birthPlace ?? null,
    birthDate: partial.birthDate ?? null,
    gender: partial.gender ?? null,
    address: partial.address ?? null,
    kyuLama: partial.kyuLama ?? "",
    kyuBaru: partial.kyuBaru ?? null,
    memberCurrentRank: partial.memberCurrentRank ?? null,
    birthCertificateUrl: null,
    bpjsCardUrl: null,
    dojoName: partial.dojoName ?? "GADING",
    dojoId: partial.dojoId ?? "d-gading",
    status: partial.status ?? "APPROVED",
    billingId: null,
    billingStatus: null,
    billingAmount: null,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendancePct: null,
    attendanceCount: 0,
    examResult: partial.examResult ?? "LULUS",
    examPresent: true,
    ...partial,
  };
}

describe("sabukLabelFromKyuBaru", () => {
  it("memetakan angka Kyu ke warna Diana", () => {
    expect(sabukLabelFromKyuBaru("10")).toBe("PUTIH");
    expect(sabukLabelFromKyuBaru("8")).toBe("KUNING");
    expect(sabukLabelFromKyuBaru("Kuning (Kyu 7)")).toBe("KUNING");
    expect(sabukLabelFromKyuBaru("6")).toBe("HIJAU");
    expect(sabukLabelFromKyuBaru("5")).toBe("BIRU");
    expect(sabukLabelFromKyuBaru("4")).toBe("BIRU");
    expect(sabukLabelFromKyuBaru("Coklat (Kyu 3)")).toBe("COKELAT");
    expect(sabukLabelFromKyuBaru("2")).toBe("COKELAT");
  });

  it("DAN / Hitam tidak dipaksa ke Cokelat", () => {
    expect(sabukLabelFromKyuBaru("Hitam (DAN 1)")).toBe("HITAM");
    expect(sabukLabelFromKyuBaru("dan 2")).toBe("HITAM");
  });
});

describe("buildUktHasilUjianRecapRows", () => {
  it("hanya peserta terdaftar yang punya Kyu Baru", () => {
    const recap = buildUktHasilUjianRecapRows([
      row({
        memberId: "a",
        fullName: "Ada Hasil",
        kyuLama: "Putih (Kyu 10)",
        kyuBaru: "Kuning (Kyu 8)",
      }),
      row({
        memberId: "b",
        fullName: "Belum Hasil",
        kyuLama: "Putih (Kyu 10)",
        kyuBaru: null,
      }),
      row({
        memberId: "c",
        fullName: "Belum Daftar",
        registrationId: null,
        kyuLama: "Putih (Kyu 10)",
        kyuBaru: "Kuning (Kyu 8)",
      }),
    ]);
    expect(recap).toHaveLength(1);
    expect(recap[0].nama).toBe("ADA HASIL");
    expect(recap[0].kyuLama).toBe("10");
    expect(recap[0].kyuBaru).toBe("8");
    expect(recap[0].sabuk).toBe("KUNING");
  });

  it("Kyu Lama dari snapshot, bukan currentRank setelah lulus", () => {
    const recap = buildUktHasilUjianRecapRows([
      row({
        memberId: "a",
        fullName: "Selesai",
        kyuLama: "Putih (Kyu 10)",
        kyuBaru: "Kuning (Kyu 8)",
        memberCurrentRank: "Kuning (Kyu 8)",
      }),
    ]);
    expect(recap[0].kyuLama).toBe("10");
    expect(recap[0].kyuBaru).toBe("8");
  });

  it("urut ranting A-Z, dalam ranting Kyu Lama 10→1, nomor ranting reset", () => {
    const recap = buildUktHasilUjianRecapRows([
      row({
        memberId: "b1",
        fullName: "Beta Biru",
        dojoId: "d-benshi",
        dojoName: "BENSHI",
        kyuLama: "Biru (Kyu 5)",
        kyuBaru: "Biru (Kyu 4)",
      }),
      row({
        memberId: "a2",
        fullName: "Ana Hijau",
        dojoId: "d-air",
        dojoName: "AIRLANGGA",
        kyuLama: "Hijau (Kyu 6)",
        kyuBaru: "Hijau (Kyu 6)",
      }),
      row({
        memberId: "a1",
        fullName: "Ana Putih",
        dojoId: "d-air",
        dojoName: "AIRLANGGA",
        kyuLama: "Putih (Kyu 10)",
        kyuBaru: "Kuning (Kyu 8)",
      }),
    ]);
    expect(recap.map((r) => r.nama)).toEqual([
      "ANA PUTIH",
      "ANA HIJAU",
      "BETA BIRU",
    ]);
    expect(recap.map((r) => r.no)).toEqual([1, 2, 3]);
    expect(recap.map((r) => r.noRanting)).toEqual([1, 2, 1]);
    expect(recap.map((r) => r.ranting)).toEqual([
      "AIRLANGGA",
      "AIRLANGGA",
      "BENSHI",
    ]);
  });
});

describe("resolveUktHasilUjianLastNia", () => {
  it("mengambil NIA numerik tertinggi, bukan baris terakhir", () => {
    const recap = buildUktHasilUjianRecapRows([
      row({
        memberId: "a",
        fullName: "A",
        nia: "26.37684",
        dojoName: "AIRLANGGA",
        dojoId: "a",
        kyuLama: "10",
        kyuBaru: "8",
      }),
      row({
        memberId: "b",
        fullName: "B",
        nia: "25.35828",
        dojoName: "BENSHI",
        dojoId: "b",
        kyuLama: "8",
        kyuBaru: "7",
      }),
      row({
        memberId: "c",
        fullName: "C",
        nia: "1719079",
        dojoName: "GADING",
        dojoId: "c",
        kyuLama: "7",
        kyuBaru: "6",
      }),
    ]);
    expect(recap.at(-1)?.nia).toBe("1719079");
    expect(resolveUktHasilUjianLastNia(recap)).toBe("26.37684");
  });
});

describe("count + filename + ttl", () => {
  it("hitungan sabuk termasuk HITAM dan jumlah ranting dari cakupan", () => {
    const recap = buildUktHasilUjianRecapRows([
      row({
        memberId: "a",
        fullName: "A",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "10",
        kyuBaru: "8",
      }),
      row({
        memberId: "b",
        fullName: "B",
        dojoId: "d1",
        dojoName: "GADING",
        kyuLama: "3",
        kyuBaru: "Hitam (DAN 1)",
      }),
      row({
        memberId: "c",
        fullName: "C",
        dojoId: "d2",
        dojoName: "FORTRESS",
        kyuLama: "8",
        kyuBaru: "7",
      }),
    ]);
    expect(countUktHasilUjianSabuk(recap)).toMatchObject({
      KUNING: 2,
      HITAM: 1,
      PUTIH: 0,
    });
    expect(countUktHasilUjianRanting(recap)).toBe(2);
  });

  it("TTL panjang Indonesia dan nama file pakai examAt", () => {
    expect(formatUktHasilUjianTtl("SURABAYA", "2011-02-28")).toBe(
      "Surabaya, 28 Februari 2011",
    );
    expect(buildUktHasilUjianFilename("II", 2026, "2026-10-05")).toBe(
      "SURABAYA_UKT_SII_2026_5-Oktober-2026.xlsx",
    );
    expect(buildUktHasilUjianFilename("II", 2026, "2026-10-05", "pdf")).toBe(
      "SURABAYA_UKT_SII_2026_5-Oktober-2026.pdf",
    );
    expect(hasUktHasilUjianRecap([])).toBe(false);
  });
});
