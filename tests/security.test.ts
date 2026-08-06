import { describe, expect, it } from "vitest";
import {
  assertDefaultNiaPassword,
  validateMemberSelfPassword,
  validatePassword,
} from "../src/lib/security/password";

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

  it("rejects NIA-style defaults (digits + dots)", () => {
    expect(validatePassword("26.37609").valid).toBe(false);
  });
});

describe("assertDefaultNiaPassword", () => {
  it("accepts password equal to NIA", () => {
    expect(assertDefaultNiaPassword("26.37609", "26.37609")).toBe(true);
  });

  it("is case-insensitive on NIA", () => {
    expect(assertDefaultNiaPassword("ab.12", "AB.12")).toBe(true);
  });

  it("rejects mismatch", () => {
    expect(assertDefaultNiaPassword("26.37609", "26.37610")).toBe(false);
  });
});

describe("validateMemberSelfPassword", () => {
  it("rejects password equal to NIA", () => {
    expect(validateMemberSelfPassword("26.37609", "26.37609").valid).toBe(false);
  });

  it("accepts strong password different from NIA", () => {
    expect(validateMemberSelfPassword("InkaiSby2026", "26.37609").valid).toBe(
      true,
    );
  });
});
