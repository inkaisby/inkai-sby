import { describe, expect, it } from "vitest";
import { validatePassword } from "../src/lib/security/password";

describe("validatePassword", () => {
  it("rejects short passwords", () => {
    expect(validatePassword("abc1").valid).toBe(false);
  });

  it("accepts strong passwords", () => {
    expect(validatePassword("InkaiSby2026").valid).toBe(true);
  });

  it("rejects common passwords", () => {
    expect(validatePassword("password").valid).toBe(false);
  });
});
