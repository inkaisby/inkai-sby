import { describe, expect, it } from "vitest";
import {
  normalizeCachedUktEventsResult,
  shouldLoadUktPeriodsFromPrisma,
} from "@/lib/inkai-api/admin-data";
import { isLatberEventTitle } from "@/lib/latber";
import {
  isUktAdminEventTitle,
  resolveUktAdminCanonicalRedirect,
  resolveUktSelectedPeriodId,
  type UktPeriodOption,
} from "@/lib/ukt";

describe("isUktAdminEventTitle", () => {
  it("accepts UKT semester titles", () => {
    expect(isUktAdminEventTitle("UKT Semester II-2026")).toBe(true);
    expect(isUktAdminEventTitle("UKT Semester I-2025")).toBe(true);
  });

  it("rejects Latber titles that mention UKT", () => {
    expect(isUktAdminEventTitle("Latihan Bersama — persiapan UKT")).toBe(false);
    expect(isUktAdminEventTitle("Latber persiapan UKT")).toBe(false);
  });
});

describe("isLatberEventTitle", () => {
  it("accepts Latihan Bersama persiapan UKT", () => {
    expect(isLatberEventTitle("Latihan Bersama — persiapan UKT")).toBe(true);
  });
});

describe("shouldLoadUktPeriodsFromPrisma", () => {
  it("always merges Prisma so periods survive Inkai cache blips", () => {
    expect(shouldLoadUktPeriodsFromPrisma(false, 0)).toBe(true);
    expect(shouldLoadUktPeriodsFromPrisma(false, 2)).toBe(true);
    expect(shouldLoadUktPeriodsFromPrisma(true, 0)).toBe(true);
    expect(shouldLoadUktPeriodsFromPrisma(true, 1)).toBe(true);
  });
});

describe("resolveUktSelectedPeriodId", () => {
  const uktActive: UktPeriodOption = {
    id: "92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
    title: "UKT Semester II-2026",
    startDate: "2026-12-31T23:59:59.999Z",
    endDate: "2026-12-31T23:59:59.999Z",
    archived: false,
    locked: false,
  };
  const latberLike: UktPeriodOption = {
    id: "638dc635-353b-488c-bebb-10056fdf4589",
    title: "Latihan Bersama — persiapan UKT",
    startDate: "2026-08-30T16:59:00.000Z",
    endDate: "2026-08-30T16:59:00.000Z",
    archived: false,
    locked: false,
  };

  it("keeps URL UKT II-2026 period and does not switch to Latber-like event", () => {
    const id = resolveUktSelectedPeriodId(
      [uktActive, latberLike],
      "II",
      2026,
      uktActive.id,
      "registration",
    );
    expect(id).toBe(uktActive.id);
  });

  it("preserves periodFromUrl when list is empty (failed fetch)", () => {
    const id = resolveUktSelectedPeriodId(
      [],
      "II",
      2026,
      uktActive.id,
      "registration",
    );
    expect(id).toBe(uktActive.id);
  });

  it("auto-resolves active UKT period when URL has no period", () => {
    const id = resolveUktSelectedPeriodId(
      [latberLike, uktActive],
      "II",
      2026,
      null,
      "registration",
    );
    expect(id).toBe(uktActive.id);
  });

  it("auto-resolves after Prisma-hydrated periods (Inkai empty)", () => {
    const id = resolveUktSelectedPeriodId(
      [uktActive],
      "II",
      2026,
      null,
      "registration",
    );
    expect(id).toBe(uktActive.id);
  });
});

describe("resolveUktAdminCanonicalRedirect", () => {
  it("does not redirect when dataOk is false (avoids strip-period blink)", () => {
    const to = resolveUktAdminCanonicalRedirect({
      urlSemester: "II",
      urlYear: "2026",
      periodFromUrl: "92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
      targetSemester: "II",
      targetYear: 2026,
      canonicalPeriod: null,
      dataOk: false,
    });
    expect(to).toBeNull();
  });

  it("does not strip period when canonical is null even if dataOk", () => {
    const to = resolveUktAdminCanonicalRedirect({
      urlSemester: "II",
      urlYear: "2026",
      periodFromUrl: "92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
      targetSemester: "II",
      targetYear: 2026,
      canonicalPeriod: null,
      dataOk: true,
    });
    expect(to).toBeNull();
  });

  it("does not redirect when URL already matches canonical", () => {
    const to = resolveUktAdminCanonicalRedirect({
      urlSemester: "II",
      urlYear: "2026",
      periodFromUrl: "92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
      targetSemester: "II",
      targetYear: 2026,
      canonicalPeriod: "92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
      dataOk: true,
    });
    expect(to).toBeNull();
  });

  it("fills missing period once when canonical is known", () => {
    const to = resolveUktAdminCanonicalRedirect({
      urlSemester: "II",
      urlYear: "2026",
      periodFromUrl: null,
      targetSemester: "II",
      targetYear: 2026,
      canonicalPeriod: "92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
      dataOk: true,
    });
    expect(to).toBe(
      "/admin/ukt?semester=II&year=2026&period=92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
    );
  });
});

describe("normalizeCachedUktEventsResult", () => {
  const events = [{ id: "92e84ee6", title: "UKT Semester II-2026" }];

  it("accepts legacy cached array payload", () => {
    expect(normalizeCachedUktEventsResult(events)).toEqual({
      ok: true,
      events,
    });
  });

  it("accepts current object payload", () => {
    expect(normalizeCachedUktEventsResult({ ok: true, events })).toEqual({
      ok: true,
      events,
    });
  });

  it("treats invalid payload as failed fetch", () => {
    expect(normalizeCachedUktEventsResult({ nope: true })).toEqual({
      ok: false,
      events: [],
    });
  });
});
