import { describe, expect, it } from "vitest";

import { buildMemberIdentityLocalData } from "../src/lib/member-identity-local";

describe("member identity local", () => {
  it("normalisasi field identitas untuk Prisma", () => {
    const data = buildMemberIdentityLocalData({
      nik: "3201010101010001",
      gender: "L",
      birthPlace: "surabaya",
      birthDate: "2011-02-28",
      address: "jl contoh",
      currentRank: "Biru (Kyu 5)",
      nia: "24.32849",
      mshNumber: null,
    });
    expect(data.nik).toBe("3201010101010001");
    expect(data.gender).toBe("L");
    expect(data.birthPlace).toBe("SURABAYA");
    expect(data.address).toBe("JL CONTOH");
    expect(data.currentRank).toBe("Biru (Kyu 5)");
    expect(data.nia).toBe("24.32849");
    expect(data.birthDate).toBeInstanceOf(Date);
  });

  it("nia kosong tidak ditulis ke data", () => {
    const data = buildMemberIdentityLocalData({
      nik: "",
      gender: "P",
      birthPlace: "Malang",
      birthDate: "2000-01-01",
      address: "Alamat",
      currentRank: "Putih (Kyu 10)",
    });
    expect(data.nia).toBeUndefined();
    expect(data.gender).toBe("P");
    expect(data.birthPlace).toBe("MALANG");
  });
});
