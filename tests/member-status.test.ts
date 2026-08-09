import { describe, expect, it } from "vitest";
import {
  isMemberActiveStatus,
  isMemberInactiveLike,
  isMemberLoginBlocked,
} from "../src/lib/security/member-status";

describe("isMemberActiveStatus", () => {
  it("accepts Active (canonical DB default)", () => {
    expect(isMemberActiveStatus("Active")).toBe(true);
  });

  it("accepts ACTIVE uppercase", () => {
    expect(isMemberActiveStatus("ACTIVE")).toBe(true);
  });

  it("accepts Aktif with surrounding whitespace", () => {
    expect(isMemberActiveStatus("  Aktif  ")).toBe(true);
  });

  it("rejects inactive-like and pending statuses", () => {
    expect(isMemberActiveStatus("INACTIVE")).toBe(false);
    expect(isMemberActiveStatus("SUSPENDED")).toBe(false);
    expect(isMemberActiveStatus("PENDING")).toBe(false);
    expect(isMemberActiveStatus("REJECTED")).toBe(false);
  });

  it("rejects empty or missing status", () => {
    expect(isMemberActiveStatus("")).toBe(false);
    expect(isMemberActiveStatus(null)).toBe(false);
    expect(isMemberActiveStatus(undefined)).toBe(false);
  });
});

describe("isMemberInactiveLike / isMemberLoginBlocked", () => {
  it("flags INACTIVE and SUSPENDED as inactive-like", () => {
    expect(isMemberInactiveLike("INACTIVE")).toBe(true);
    expect(isMemberInactiveLike("suspended")).toBe(true);
    expect(isMemberInactiveLike("Active")).toBe(false);
  });

  it("blocks login for pending/rejected as well as inactive", () => {
    expect(isMemberLoginBlocked("PENDING")).toBe(true);
    expect(isMemberLoginBlocked("REJECTED")).toBe(true);
    expect(isMemberLoginBlocked("Active")).toBe(false);
  });
});
