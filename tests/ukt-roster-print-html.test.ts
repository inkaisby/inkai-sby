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
