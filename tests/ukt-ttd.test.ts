import { describe, expect, it } from "vitest";

import { UKT_HASIL_UJIAN_OFFICERS } from "../src/lib/ukt";
import {
  formatUktOfficerTitle,
  resolveUktTtdOfficers,
} from "../src/lib/ukt-ttd";

describe("formatUktOfficerTitle", () => {
  it("menyusun DAN + No. MSH", () => {
    expect(formatUktOfficerTitle("Hitam (DAN 7)", "2702")).toBe(
      "DAN 7 INKAI MSH NO. 2702",
    );
    expect(formatUktOfficerTitle("Dan 6", "245")).toBe(
      "DAN 6 INKAI MSH NO. 245",
    );
    expect(formatUktOfficerTitle("Hitam (DAN 1)", null)).toBe("DAN 1 INKAI");
    expect(formatUktOfficerTitle("Putih (Kyu 10)", "1")).toBe(
      "INKAI MSH NO. 1",
    );
  });
});

describe("resolveUktTtdOfficers", () => {
  it("meta mengalahkan template/org/konstanta; template mengalahkan org", () => {
    const resolved = resolveUktTtdOfficers({
      meta: {
        archived: false,
        locked: false,
        pengdaKetua: "Meta Pengda",
        pengujiNames: ["Meta 1"],
        pengdaKetuaSignUrl: "https://cdn/meta.png",
      },
      template: {
        pengdaKetua: "Tpl Pengda",
        mshKetua: "Tpl MSH",
        pengujiNames: ["Tpl 1", "Tpl 2"],
        pengdaKetuaSignUrl: "https://cdn/tpl.png",
        mshKetuaSignUrl: "https://cdn/msh.png",
      },
      pengprovHeadName: "Org Pengprov",
      orgKetuaCabangName: "Org Ketua",
      strukturKetuaName: "Struktur Ketua",
      orgBidangUjianName: "Org Bidang",
    });

    expect(resolved.pengdaKetua).toBe("Meta Pengda");
    expect(resolved.pengdaKetuaSignUrl).toBe("https://cdn/meta.png");
    expect(resolved.mshKetua).toBe("Tpl MSH");
    expect(resolved.mshKetuaSignUrl).toBe("https://cdn/msh.png");
    expect(resolved.ketuaCabangName).toBe("Org Ketua");
    expect(resolved.bidangUjianName).toBe("Org Bidang");
    expect(resolved.pengujiNames).toEqual(["Meta 1"]);
    expect(resolved.pengujiSignUrls).toEqual([""]);
  });

  it("fallback Pengprov headName lalu konstanta pejabat", () => {
    const withOrg = resolveUktTtdOfficers({
      pengprovHeadName: "SUYANTO KASDI",
      strukturKetuaName: "Jonathan Tes",
    });
    expect(withOrg.pengdaKetua).toBe("SUYANTO KASDI");
    expect(withOrg.ketuaCabangName).toBe("Jonathan Tes");
    expect(withOrg.mshKetua).toBe(UKT_HASIL_UJIAN_OFFICERS.mshKetua);
    expect(withOrg.pengdaKetuaTitle).toBe(
      UKT_HASIL_UJIAN_OFFICERS.pengdaKetuaTitle,
    );

    const bare = resolveUktTtdOfficers({});
    expect(bare.pengdaKetua).toBe(UKT_HASIL_UJIAN_OFFICERS.pengdaKetua);
    expect(bare.bidangUjianName).toBe("SETIA BASUKI");
  });
});
