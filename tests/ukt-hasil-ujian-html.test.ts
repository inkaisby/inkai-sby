import { describe, expect, it } from "vitest";

import { buildUktHasilUjianPrintHtml } from "../src/lib/ukt-hasil-ujian-html";
import {
  buildUktHasilUjianRecapRows,
  UKT_HASIL_UJIAN_OFFICERS,
  type UktMemberRow,
} from "../src/lib/ukt";

function row(
  partial: Partial<UktMemberRow> & Pick<UktMemberRow, "memberId" | "fullName">,
): UktMemberRow {
  return {
    registrationId: `reg-${partial.memberId}`,
    photoUrl: null,
    nia: partial.nia ?? "26.37619",
    birthPlace: "Surabaya",
    birthDate: "2011-02-28",
    gender: "P",
    address: "Jl. Contoh",
    kyuLama: partial.kyuLama ?? "Putih (Kyu 10)",
    kyuBaru: partial.kyuBaru ?? "Kuning (Kyu 8)",
    birthCertificateUrl: null,
    bpjsCardUrl: null,
    dojoName: partial.dojoName ?? "AIRLANGGA",
    dojoId: partial.dojoId ?? "d-air",
    status: "APPROVED",
    billingId: null,
    billingStatus: null,
    billingAmount: null,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendancePct: null,
    attendanceCount: 0,
    examResult: "LULUS",
    examPresent: true,
    ...partial,
  };
}

describe("buildUktHasilUjianPrintHtml", () => {
  it("menyusun 2 halaman Pengda + logo INKAI", () => {
    const recap = buildUktHasilUjianRecapRows([
      row({ memberId: "a", fullName: "Ana Putih" }),
      row({
        memberId: "b",
        fullName: "Bima Dan",
        dojoId: "d-gading",
        dojoName: "GADING",
        kyuLama: "Coklat (Kyu 3)",
        kyuBaru: "Hitam (DAN 1)",
        nia: "26.39999",
      }),
    ]);
    const html = buildUktHasilUjianPrintHtml({
      semester: "II",
      year: 2026,
      examAt: "2026-10-05",
      ketuaCabangName: "Ketua Tes",
      bidangUjianName: "SETIA BASUKI",
      origin: "https://inkai-sby.vercel.app",
      rows: recap,
    });

    expect(html).toContain("REKAP HASIL UJIAN SEMESTER II TAHUN 2026");
    expect(html).toContain("https://inkai-sby.vercel.app/logo-inkai.png");
    expect(html).toContain("INSTITUT KARATE-DO INDONESIA");
    expect(html).toContain("KAB/KOTA  :  SURABAYA");
    expect(html).toContain("NO. URUT PESERTA RANTING");
    expect(html).toContain("TEMPAT TANGGAL LAHIR");
    expect(html).toContain("ANA PUTIH");
    expect(html).toContain("BIMA DAN");
    expect(html).toContain("Mengetahui");
    expect(html).toContain("5 Oktober 2026");
    expect(html).toContain("CATATAN");
    expect(html).toContain("NIA TERAKHIR");
    expect(html).toContain("26.39999");
    expect(html).toContain("JUMLAH RANTING YANG IKUT UJIAN : 2 RANTING");
    expect(html).toContain(UKT_HASIL_UJIAN_OFFICERS.pengdaKetua);
    expect(html).toContain(UKT_HASIL_UJIAN_OFFICERS.mshKetua);
    expect(html).toContain("Ketua Tes");
    expect(html).toContain("SETIA BASUKI");
    expect(html.match(/class="page"/g)?.length).toBe(2);
    expect(html.match(/logo-inkai\.png/g)?.length).toBe(2);
  });

  it("mencetak pejabat payload + penguji di kolom kanan CATATAN, sabuk rapat", () => {
    const recap = buildUktHasilUjianRecapRows([
      row({ memberId: "a", fullName: "Ana Putih" }),
      row({
        memberId: "b",
        fullName: "Bima Kuning",
        kyuLama: "Putih (Kyu 10)",
        kyuBaru: "Kuning (Kyu 8)",
      }),
    ]);
    const html = buildUktHasilUjianPrintHtml({
      semester: "I",
      year: 2026,
      origin: "https://example.com",
      pengdaKetua: "SUYANTO KASDI",
      pengdaKetuaTitle: "DAN 7 INKAI MSH NO. 2702",
      mshKetua: "S YAHRULLAH",
      mshKetuaTitle: "DAN 6 INKAI MSH NO. 245",
      ketuaCabangName: "JONATHAN",
      bidangUjianName: "SETIA BASUKI",
      pengujiNames: ["Ahmad Penguji", "Budi Penguji"],
      pengdaKetuaSignUrl: "https://cdn.example.com/ukt-ttd/pengda.png",
      rows: recap,
    });

    expect(html).toContain("SUYANTO KASDI");
    expect(html).toContain("DAN 7 INKAI MSH NO. 2702");
    expect(html).toContain("S YAHRULLAH");
    expect(html).toContain("JONATHAN");
    expect(html).toContain("NAMA-NAMA PENGUJI");
    expect(html).toContain("1. Ahmad Penguji");
    expect(html).toContain("2. Budi Penguji");
    expect(html).toMatch(/SABUK KUNING = 2/);
    expect(html).toMatch(/SABUK PUTIH = 0/);
    expect(html).toContain('class="sign-img"');
    expect(html).toContain("https://cdn.example.com/ukt-ttd/pengda.png");
    expect(html).not.toContain("NAMA PELATIH");
    expect(html).not.toContain("NAMA-NAMA PELATIH");
  });

  it("tanpa URL tanda tangan tetap ruang kosong (tanpa img)", () => {
    const recap = buildUktHasilUjianRecapRows([
      row({ memberId: "a", fullName: "Ana Putih" }),
    ]);
    const html = buildUktHasilUjianPrintHtml({
      semester: "I",
      year: 2026,
      origin: "https://example.com",
      rows: recap,
    });
    expect(html).toContain('class="sign-space"');
    expect(html).not.toContain('class="sign-img"');
  });
});
