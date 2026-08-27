import { describe, expect, it } from "vitest";

import {
  decodeJwtExpSeconds,
  isInkaiTokenSoftValid,
  portalStatusFromInkai,
  shouldAutoEnterPortal,
  shouldPreferServiceToken,
} from "../src/lib/inkai-api/auth-gateway";
import {
  isUnauthorizedPayload,
  SESSION_EXPIRED_MESSAGE,
} from "../src/lib/session-expired";

function fakeJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${header}.${payload}.sig`;
}

describe("portalStatusFromInkai", () => {
  it("maps Inkai 401 to 502 (never portal 401)", () => {
    expect(portalStatusFromInkai(401)).toBe(502);
  });

  it("preserves validation 400 and 403", () => {
    expect(portalStatusFromInkai(400)).toBe(400);
    expect(portalStatusFromInkai(403)).toBe(403);
  });
});

describe("JWT soft validity", () => {
  const now = 1_700_000_000;

  it("decodeJwtExpSeconds reads exp", () => {
    expect(decodeJwtExpSeconds(fakeJwt(now + 100))).toBe(now + 100);
  });

  it("isInkaiTokenSoftValid false when expired", () => {
    expect(isInkaiTokenSoftValid(fakeJwt(now - 10), now)).toBe(false);
  });

  it("isInkaiTokenSoftValid true when future", () => {
    expect(isInkaiTokenSoftValid(fakeJwt(now + 3600), now)).toBe(true);
  });

  it("shouldPreferServiceToken when near expiry", () => {
    expect(shouldPreferServiceToken(fakeJwt(now + 60), now, 300)).toBe(true);
    expect(shouldPreferServiceToken(fakeJwt(now + 3600), now, 300)).toBe(
      false,
    );
  });
});

describe("shouldAutoEnterPortal", () => {
  const now = 1_700_000_000;

  it("blocks auto-enter when JWT expired", () => {
    expect(
      shouldAutoEnterPortal({
        hasSession: true,
        inkaiToken: fakeJwt(now - 1),
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("allows auto-enter when session + valid token", () => {
    expect(
      shouldAutoEnterPortal({
        hasSession: true,
        inkaiToken: fakeJwt(now + 600),
        nowSec: now,
      }),
    ).toBe(true);
  });
});

describe("isUnauthorizedPayload", () => {
  it("redirects only for SESSION_EXPIRED_MESSAGE", () => {
    expect(isUnauthorizedPayload(401, SESSION_EXPIRED_MESSAGE)).toBe(true);
    expect(
      isUnauthorizedPayload(
        401,
        "Sesi API berakhir. Silakan refresh halaman atau login ulang, lalu coba lagi.",
      ),
    ).toBe(false);
    expect(isUnauthorizedPayload(502, "Gagal memperbarui sabuk")).toBe(false);
  });
});
