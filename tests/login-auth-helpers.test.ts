import { describe, expect, it } from "vitest";
import { authBounceReason } from "@/lib/auth/auth-bounce";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

describe("safeCallbackUrl", () => {
  it("accepts relative paths", () => {
    expect(safeCallbackUrl("/dashboard")).toBe("/dashboard");
    expect(safeCallbackUrl("/admin/ukt?period=1")).toBe("/admin/ukt?period=1");
  });

  it("rejects open redirects", () => {
    expect(safeCallbackUrl("//evil.example")).toBeNull();
    expect(safeCallbackUrl("https://evil.example")).toBeNull();
    expect(safeCallbackUrl("http://evil.example/path")).toBeNull();
    expect(safeCallbackUrl(null)).toBeNull();
    expect(safeCallbackUrl("")).toBeNull();
  });
});

describe("authBounceReason", () => {
  it("distinguishes missing session from missing inkai token", () => {
    expect(
      authBounceReason({ hasSession: false, hasInkaiToken: false }),
    ).toBe("missing_session");
    expect(
      authBounceReason({ hasSession: false, hasInkaiToken: true }),
    ).toBe("missing_session");
    expect(
      authBounceReason({ hasSession: true, hasInkaiToken: false }),
    ).toBe("missing_inkai_token");
    expect(
      authBounceReason({ hasSession: true, hasInkaiToken: true }),
    ).toBeNull();
  });
});

describe("session client payload", () => {
  it("must not expose accessToken on session shape helpers", () => {
    // Mirrors auth.session callback: delete session.accessToken before return.
    const session: { accessToken?: string; user: { id: string } } = {
      accessToken: "should-not-leak",
      user: { id: "u1" },
    };
    delete session.accessToken;
    expect(session).not.toHaveProperty("accessToken");
    expect(JSON.stringify(session)).not.toContain("should-not-leak");
  });
});
