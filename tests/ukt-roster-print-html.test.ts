import { describe, expect, it } from "vitest";
import {
  buildUktRosterPrintHtml,
  uktRosterPageSizeCss,
} from "../src/lib/ukt-roster-print-html";
import {
  comparePublicUktRows,
  sortPublicUktRows,
} from "../src/lib/ukt-public-roster-sort";
import type { UktPublicRegistrant } from "../src/lib/ukt-public";
import { compareUktRanks } from "../src/lib/belt";
import {
  buildUktPesertaExportRows,
  buildUktHasilUjianRecapRows,
  type UktMemberRow,
} from "../src/lib/ukt";
import { buildUktPesertaPrintHtml } from "../src/lib/ukt-print-html";

function row(partial: Partial<UktPublicRegistrant> & Pick<UktPublicRegistrant, "id" | "fullName">): UktPublicRegistrant {
  return {
    photoUrl: null,
    nia: null,
    kyuLama: "",
    kyuBaru: null,
    ranting: "Ranting A",
    status: "menunggu_ujian",
    statusLabel: "Menunggu Ujian",
    rankForRing: null,
    createdAt: "2026-01-15T10:00:00.000Z",
    ...partial,
  };
}

describe("compareUktRanks", () => {
  it("mengurutkan Kyu 10→1 lalu Dan 1→10", () => {
    expect(compareUktRanks("Putih (Kyu 10)", "Kuning (Kyu 8)")).toBeLessThan(0);
    expect(compareUktRanks("Kyu 8", "Kyu 10")).toBeGreaterThan(0);
    expect(compareUktRanks("Coklat (Kyu 1)", "Hitam (DAN 1)")).toBeLessThan(0);
    expect(compareUktRanks("Hitam (DAN 1)", "Hitam (DAN 2)")).toBeLessThan(0);
    expect(compareUktRanks("10", "8")).toBeLessThan(0);
  });
});

describe("buildUktPesertaExportRows", () => {
  it("mengurutkan berdasarkan Ranting (A-Z) lalu Kyu 10→1 lalu Nama", () => {
    const rows: UktMemberRow[] = [
      { registrationId: "1", dojoName: "AIRLANGGA", fullName: "ZACK", kyuLama: "Kyu 5" },
      { registrationId: "2", dojoName: "AIRLANGGA", fullName: "ALPHA", kyuLama: "Kyu 10" },
      { registrationId: "3", dojoName: "AIRLANGGA", fullName: "BOB", kyuLama: "Kyu 5" },
      { registrationId: "4", dojoName: "AIRLANGGA", fullName: "DANNY", kyuLama: "Hitam (DAN 1)" },
      { registrationId: "5", dojoName: "BENSHI", fullName: "CAROL", kyuLama: "Kyu 8" },
    ];
    const result = buildUktPesertaExportRows(rows);
    expect(result.map((r) => `${r.ranting}-${r.kyu}-${r.nama}`)).toEqual([
      "AIRLANGGA-10-ALPHA",
      "AIRLANGGA-5-BOB",
      "AIRLANGGA-5-ZACK",
      "AIRLANGGA-1-DANNY",
      "BENSHI-8-CAROL",
    ]);
  });
});

describe("buildUktHasilUjianRecapRows", () => {
  it("mengurutkan hasil ujian per Ranting lalu Kyu 10→1 lalu Nama", () => {
    const rows: UktMemberRow[] = [
      { registrationId: "1", dojoName: "DOJO A", fullName: "Z", kyuLama: "Kyu 3", kyuBaru: "Kyu 2", examResult: "LULUS" },
      { registrationId: "2", dojoName: "DOJO A", fullName: "A", kyuLama: "Kyu 10", kyuBaru: "Kyu 9", examResult: "LULUS" },
    ];
    const result = buildUktHasilUjianRecapRows(rows);
    expect(result.map((r) => `${r.ranting}-${r.kyuLama}-${r.nama}`)).toEqual([
      "DOJO A-10-A",
      "DOJO A-3-Z",
    ]);
  });
});

describe("buildUktPesertaPrintHtml CSS Alignment", () => {
  it("menggunakan vertical-align middle dan text-align center pada header dan NIA", () => {
    const html = buildUktPesertaPrintHtml({
      title: "DAFTAR PESERTA UJIAN SEMESTER II TAHUN 2026",
      branchLabel: "CABANG SURABAYA",
      printedPlaceDate: "Surabaya, 5 September 2026",
      signatoryTitle: "Ketua Pengcab INKAI Surabaya",
      signatoryName: "Pengurus Cabang",
      origin: "https://inkai-sby.vercel.app",
      rows: [
        {
          no: 1,
          noRanting: 1,
          nia: "26.37623",
          nama: "CONSTANTINE",
          tempatTanggalLahir: "SURABAYA, 12/06/2020",
          jenisKelamin: "L",
          alamat: "JL. PLOSO",
          kyu: "8",
          kyuBaru: "",
          ranting: "AIRLANGGA",
        },
      ],
    });
    expect(html).toContain("vertical-align: middle");
    expect(html).toContain("text-align: center");
    expect(html).toContain("<th>No. R</th>");
    expect(html).toContain('<td class="c">26.37623</td>');
    expect(html).toContain('<td class="c">1</td>');
  });
});

describe("sortPublicUktRows", () => {
  it("pertahankan urutan API bila belum sort", () => {
    const rows = [
      row({ id: "1", fullName: "Charlie" }),
      row({ id: "2", fullName: "Alpha" }),
    ];
    const out = sortPublicUktRows(rows, null, "asc");
    expect(out.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("sort Kyu numerik bukan alfabet", () => {
    const rows = [
      row({ id: "1", fullName: "A", kyuLama: "Kyu 2" }),
      row({ id: "2", fullName: "B", kyuLama: "Kyu 10" }),
    ];
    const out = sortPublicUktRows(rows, "kyuLama", "asc");
    expect(out.map((r) => r.id)).toEqual(["2", "1"]);
    expect(comparePublicUktRows(rows[0]!, rows[1]!, "kyuLama", "asc")).toBeGreaterThan(0);
  });
});

describe("buildUktRosterPrintHtml", () => {
  it("memuat judul UKT, kolom Kyu, dan checkbox", () => {
    const html = buildUktRosterPrintHtml({
      periodTitle: "UKT Semester II-2026",
      dojoLabel: "RANTING A",
      participantCount: 1,
      showRantingColumn: false,
      paper: "A4",
      orientation: "landscape",
      origin: "https://inkai-sby.vercel.app",
      printedAt: "30 Agustus 2026",
      rows: [
        {
          no: 1,
          nia: "123",
          nama: "Budi Santoso",
          kyuLama: "Kyu 8",
          kyuBaru: "Kyu 7",
          status: "Menunggu Ujian",
          tglDaftar: "15/01/2026",
        },
      ],
    });

    expect(html).toContain("Daftar Peserta Ujian Kenaikan Tingkat");
    expect(html).toContain("UKT Semester II-2026");
    expect(html).toContain("Kyu Lama");
    expect(html).toContain("Kyu Baru");
    expect(html).toContain("☐");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("overflow-wrap: anywhere");
  });

  it("menampilkan kolom ranting bila gabungan", () => {
    const html = buildUktRosterPrintHtml({
      periodTitle: "UKT",
      dojoLabel: "GABUNGAN (A, B)",
      participantCount: 0,
      showRantingColumn: true,
      origin: "https://example.com",
      printedAt: "2026",
      rows: [],
    });
    expect(html).toContain("<th>Ranting</th>");
  });
});

describe("uktRosterPageSizeCss", () => {
  it("mendukung F4 landscape", () => {
    expect(uktRosterPageSizeCss("F4", "landscape")).toBe("330mm 215mm");
  });
});

