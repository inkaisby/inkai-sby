import { describe, expect, it } from "vitest";
import { shouldLoadLatberPeriodsFromPrisma } from "@/lib/latber-data";
import { findActiveLatberPeriod, isLatberEventTitle } from "@/lib/latber";

describe("shouldLoadLatberPeriodsFromPrisma", () => {
  it("loads Prisma when Inkai fetch failed", () => {
    expect(shouldLoadLatberPeriodsFromPrisma(false, 0)).toBe(true);
    expect(shouldLoadLatberPeriodsFromPrisma(false, 2)).toBe(true);
  });

  it("loads Prisma when Inkai ok but Latber list empty", () => {
    expect(shouldLoadLatberPeriodsFromPrisma(true, 0)).toBe(true);
  });

  it("skips Prisma when Inkai already returned Latber periods", () => {
    expect(shouldLoadLatberPeriodsFromPrisma(true, 1)).toBe(false);
  });
});

describe("findActiveLatberPeriod after Prisma hydrate", () => {
  it("picks non-archived Latber period", () => {
    const active = findActiveLatberPeriod([
      {
        id: "638dc635-353b-488c-bebb-10056fdf4589",
        title: "Latihan Bersama — persiapan UKT",
        startDate: "2026-08-30T16:59:00.000Z",
        archived: false,
        locked: false,
      },
    ]);
    expect(active?.id).toBe("638dc635-353b-488c-bebb-10056fdf4589");
    expect(isLatberEventTitle(active!.title)).toBe(true);
  });
});
