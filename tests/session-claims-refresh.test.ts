import { describe, expect, it } from "vitest";
import {
  applyJwtClaimsRefreshOutcome,
  type JwtClaimsToken,
  type SessionClaims,
} from "../src/lib/session-refresh";
import { buildUktPublicPayload } from "../src/lib/ukt-public";

const baseToken: JwtClaimsToken = {
  sub: "user-1",
  roles: ["MEMBER"],
  memberId: "member-1",
  name: "Budi",
  photoUrl: null,
  claimsUpdatedAt: 1,
};

const sampleClaims: SessionClaims = {
  name: "Budi Updated",
  photoUrl: "https://blob.test/user.webp",
  roles: ["MEMBER", "ADMIN_DOJO"],
  managedProvinceId: null,
  managedBranchId: "branch-1",
  managedDojoId: "dojo-1",
  memberId: "member-1",
};

describe("applyJwtClaimsRefreshOutcome", () => {
  it("keeps session sub when claims refresh hits Prisma drift/error", () => {
    const next = applyJwtClaimsRefreshOutcome(
      baseToken,
      {
        kind: "error",
        error: new Error(
          "The column `Member.photoUrl` does not exist in the current database. P2022",
        ),
      },
      1_700_000_000_000,
    );
    expect(next.sub).toBe("user-1");
    expect(next.error).toBeUndefined();
    expect(next.claimsUpdatedAt).toBe(1_700_000_000_000);
    expect(next.roles).toEqual(["MEMBER"]);
  });

  it("blocks session when user is missing", () => {
    const next = applyJwtClaimsRefreshOutcome(baseToken, { kind: "missing" });
    expect(next.sub).toBeUndefined();
    expect(next.error).toBe("SessionBlocked");
    expect(next.claimsUpdatedAt).toBeGreaterThan(0);
  });

  it("blocks session when user is locked/revoked", () => {
    const next = applyJwtClaimsRefreshOutcome(baseToken, { kind: "blocked" });
    expect(next.sub).toBeUndefined();
    expect(next.error).toBe("SessionBlocked");
  });

  it("applies fresh claims on success", () => {
    const next = applyJwtClaimsRefreshOutcome(baseToken, {
      kind: "ok",
      claims: sampleClaims,
    });
    expect(next.sub).toBe("user-1");
    expect(next.roles).toEqual(["MEMBER", "ADMIN_DOJO"]);
    expect(next.managedDojoId).toBe("dojo-1");
    expect(next.name).toBe("Budi Updated");
    expect(next.photoUrl).toBe("https://blob.test/user.webp");
    expect(next.error).toBeUndefined();
  });
});

describe("buildUktPublicPayload", () => {
  it("keeps period when registrants fail to load", () => {
    const payload = buildUktPublicPayload({
      period: {
        id: "92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
        title: "UKT Semester II-2026",
        startDate: "2026-12-31T23:59:59.999Z",
        endDate: "2026-12-31T23:59:59.999Z",
        archived: false,
        locked: false,
      },
      meta: {
        archived: false,
        locked: false,
        examAt: "2026-09-06T01:00:00.000Z",
        examLocation: "Dispora Jatim",
      },
      registrants: [],
      loadError: true,
    });

    expect(payload.period.periodId).toBe(
      "92e84ee6-663f-4b0e-aa1d-498bff3bc74e",
    );
    expect(payload.period.title).toContain("Semester II-2026");
    expect(payload.period.semester).toBe("II");
    expect(payload.period.year).toBe(2026);
    expect(payload.registrants).toEqual([]);
    expect(payload.loadError).toBe(true);
  });

  it("returns null period only when no period exists", () => {
    const payload = buildUktPublicPayload({
      period: null,
      meta: { archived: false, locked: false },
    });
    expect(payload.period.periodId).toBeNull();
    expect(payload.loadError).toBeUndefined();
  });
});
