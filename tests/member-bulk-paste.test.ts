import { describe, expect, it } from "vitest";

import {
  looksLikeNia,
  parseBulkMemberPasteLines,
} from "../src/lib/member-bulk-paste";

const dojos = [
  { id: "dojo-meikyo", name: "MEIKYO" },
  { id: "dojo-air", name: "AIRLANGGA" },
];

describe("member bulk paste", () => {
  it("paste 6 kolom tanpa NIA → field benar", () => {
    const text = [
      "BUDI SANTOSO\tSURABAYA, 28 Februari 2011\tL\tJL CONTOH 1\tPutih (Kyu 10)\tMEIKYO",
    ].join("\n");
    const rows = parseBulkMemberPasteLines(text, dojos, "dojo-air");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.nia).toBe("");
    expect(rows[0]!.fullName).toBe("BUDI SANTOSO");
    expect(rows[0]!.birthPlaceDate).toBe("SURABAYA, 28 Februari 2011");
    expect(rows[0]!.gender).toBe("L");
    expect(rows[0]!.address).toBe("JL CONTOH 1");
    expect(rows[0]!.currentRank).toBe("Putih (Kyu 10)");
    expect(rows[0]!.dojoId).toBe("dojo-meikyo");
  });

  it("paste 7 kolom dengan NIA kosong + nama di kolom 2", () => {
    const text =
      "\tBUDI SANTOSO\tSURABAYA, 28 Februari 2011\tL\tJL CONTOH\tBiru (Kyu 5)\tMEIKYO";
    const rows = parseBulkMemberPasteLines(text, dojos, "");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.nia).toBe("");
    expect(rows[0]!.fullName).toBe("BUDI SANTOSO");
  });

  it("paste 7 kolom dengan NIA valid tidak regress", () => {
    const text =
      "25.00001\tBUDI SANTOSO\tSURABAYA, 28 Februari 2011\tL\tJL CONTOH\tPutih (Kyu 10)\tMEIKYO";
    const rows = parseBulkMemberPasteLines(text, dojos, "");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.nia).toBe("25.00001");
    expect(rows[0]!.fullName).toBe("BUDI SANTOSO");
  });

  it("format lama JK sebelum Tempat&Tgl tetap jalan", () => {
    const text =
      "25.00002\tSITI AMINAH\tP\tSURABAYA, 1 Januari 2012\tJL LAMA\tKuning (Kyu 7)\tAIRLANGGA";
    const rows = parseBulkMemberPasteLines(text, dojos, "");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.gender).toBe("P");
    expect(rows[0]!.birthPlaceDate).toBe("SURABAYA, 1 Januari 2012");
  });

  it("looksLikeNia mengenali pola cabang", () => {
    expect(looksLikeNia("")).toBe(true);
    expect(looksLikeNia("24.32849")).toBe(true);
    expect(looksLikeNia("BUDI SANTOSO")).toBe(false);
  });
});
