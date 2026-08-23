import { describe, expect, it } from "vitest";
import {
  DEFAULT_LATBER_FEE,
  isLatberPaidStatus,
  latberDisplayStatusLabel,
  latberStatusBadgeClass,
  resolveLatberDisplayStatus,
  resolveLatberPeriodFees,
  type LatberMemberRow,
} from "@/lib/latber";
import { parseMemberCardScanPayload } from "@/lib/latber-card-scan";
import {
  isMembershipReady,
  latberGuestKey,
  parseLatberGuestMeta,
} from "@/lib/latber-guest";
import { buildLatberRosterPrintHtml } from "@/lib/latber-roster-print-html";
import { buildLatberNotaPrintHtml } from "@/lib/latber-print-html";

describe("Latber flat fee", () => {
  it("defaults to Rp45.000 without unique tail", () => {
    expect(DEFAULT_LATBER_FEE).toBe(45_000);
    expect(resolveLatberPeriodFees(null).feeAmount).toBe(45_000);
    expect(
      resolveLatberPeriodFees({ archived: false, locked: false }).feeAmount,
    ).toBe(45_000);
  });
});

describe("parseMemberCardScanPayload", () => {
  it("parses /v/ paths and URLs", () => {
    expect(
      parseMemberCardScanPayload("https://inkai-sby.vercel.app/v/36.12345"),
    ).toBe("36.12345");
    expect(parseMemberCardScanPayload("/v/abc-uuid")).toBe("abc-uuid");
    expect(parseMemberCardScanPayload("36.12345")).toBe("36.12345");
  });
});

describe("Latber paid status (lunas + tunai)", () => {
  const base: LatberMemberRow = {
    memberId: "m1",
    registrationId: "r1",
    fullName: "BUDI",
    dojoId: "d1",
    status: "APPROVED",
    billingStatus: "PAID",
  };

  it("resolves transfer PAID as lunas", () => {
    expect(resolveLatberDisplayStatus(base)).toBe("lunas");
    expect(isLatberPaidStatus("lunas")).toBe(true);
  });

  it("resolves CASH PAID as tunai", () => {
    expect(
      resolveLatberDisplayStatus({ ...base, paymentMethod: "CASH" }),
    ).toBe("tunai");
    expect(isLatberPaidStatus("tunai")).toBe(true);
    expect(latberDisplayStatusLabel("tunai")).toBe("Tunai");
    expect(latberStatusBadgeClass("tunai")).toContain("teal");
  });
});

describe("Latber guest helpers", () => {
  it("parses guest meta and key", () => {
    expect(latberGuestKey("abc")).toBe("latber-guest:abc");
    expect(
      parseLatberGuestMeta({
        source: "latber-guest",
        createdAt: "2026-08-23T00:00:00.000Z",
        eventId: "e1",
        phoneNumber: "08123456789",
      }),
    ).toEqual({
      source: "latber-guest",
      createdAt: "2026-08-23T00:00:00.000Z",
      eventId: "e1",
      phoneNumber: "08123456789",
    });
    expect(parseLatberGuestMeta({ source: "member" })).toBeNull();
  });

  it("membershipReady requires identity fields", () => {
    expect(
      isMembershipReady({
        fullName: "BUDI",
        dojoId: "d1",
        gender: "L",
        birthPlace: "SBY",
        birthDate: "2010-01-01",
        address: "JL RAYA 1",
        phoneNumber: "08123456789",
      }),
    ).toBe(true);
    expect(
      isMembershipReady({
        fullName: "BUDI",
        dojoId: "d1",
        gender: "L",
      }),
    ).toBe(false);
  });
});

describe("Latber print HTML", () => {
  it("roster includes status column", () => {
    const html = buildLatberRosterPrintHtml({
      periodTitle: "Latber Test",
      dojoLabel: "INKAI UNAIR",
      participantCount: 1,
      showRantingColumn: false,
      rows: [
        {
          no: 1,
          nia: "36.1",
          nama: "BUDI",
          sabuk: "Putih",
          status: "Belum Bayar",
          tglDaftar: "23 Agu 2026",
        },
      ],
      origin: "https://example.com",
      printedAt: "23 Agustus 2026",
    });
    expect(html).toContain("Status");
    expect(html).toContain("Belum Bayar");
    expect(html).toContain("Daftar Peserta");
  });

  it("nota includes Status and Hadir", () => {
    const html = buildLatberNotaPrintHtml({
      periodTitle: "Latber Test",
      dojoName: "INKAI UNAIR",
      rows: [
        {
          no: 1,
          nia: "36.1",
          nama: "BUDI",
          sabuk: "Putih",
          status: "Lunas",
          biaya: "Rp 45.000",
        },
      ],
      paidCount: 1,
      subtotal: "Rp 45.000",
      komisiTotal: "Rp 5.000",
      grandTotal: "Rp 40.000",
      origin: "https://example.com",
      printedAt: "23 Agustus 2026",
    });
    expect(html).toContain("Status");
    expect(html).toContain("Hadir");
    expect(html).toContain("☐");
    expect(html).toContain("Lunas");
  });
});
