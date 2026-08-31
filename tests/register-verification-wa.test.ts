import { describe, expect, it } from "vitest";

import {
  buildRegisterVerificationWaMessage,
  buildRegisterVerificationWaUrl,
  formatRegisterBirthDate,
} from "../src/lib/register-verification-wa";

describe("register verification WA", () => {
  it("memuat field wajib dan menghilangkan NIA/MSH bila kosong", () => {
    const message = buildRegisterVerificationWaMessage({
      fullName: "BUDI SANTOSO",
      gender: "L",
      birthPlace: "SURABAYA",
      birthDate: "2011-02-28",
      address: "JL CONTOH 1",
      phoneNumber: "081234567890",
      email: "budi@example.com",
    });
    expect(message).toContain("Mohon di verifikasi");
    expect(message).toContain("Nama Lengkap: BUDI SANTOSO");
    expect(message).toContain("Jenis Kelamin: Laki-laki");
    expect(message).toContain("Tempat Lahir: SURABAYA");
    expect(message).toContain("Tanggal Lahir:");
    expect(message).toContain("Alamat: JL CONTOH 1");
    expect(message).toContain("Telepon: 081234567890");
    expect(message).toContain("Email: budi@example.com");
    expect(message).toContain("Terima Kasih");
    expect(message).not.toContain("NIA:");
    expect(message).not.toContain("No. MSH:");
  });

  it("menyertakan NIA dan MSH bila diisi", () => {
    const message = buildRegisterVerificationWaMessage({
      fullName: "ANDI",
      gender: "P",
      birthPlace: "MALANG",
      birthDate: "2000-01-01",
      address: "ALAMAT",
      nia: "24.32849",
      mshNumber: "MSH-001",
      phoneNumber: "08111",
      email: "a@b.com",
    });
    expect(message).toContain("NIA: 24.32849");
    expect(message).toContain("No. MSH: MSH-001");
    expect(message).toContain("Jenis Kelamin: Perempuan");
  });

  it("format tanggal lahir Indonesia", () => {
    const formatted = formatRegisterBirthDate("2011-02-28");
    expect(formatted).toMatch(/28.*2011/);
  });

  it("URL WA encode benar", () => {
    const url = buildRegisterVerificationWaUrl("6281331053100", "Halo\nDunia");
    expect(url).toContain("https://api.whatsapp.com/send?phone=6281331053100");
    expect(url).toContain("text=");
    expect(decodeURIComponent(url.split("text=")[1]!)).toBe("Halo\nDunia");
  });
});
