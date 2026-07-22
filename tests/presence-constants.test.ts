import { describe, expect, it } from "vitest";
import {
  canViewAccountPresence,
  formatRelativeId,
  ONLINE_THRESHOLD_MS,
} from "../src/lib/presence-constants";

describe("presence-constants", () => {
  it("allows pusat and cabang only", () => {
    expect(canViewAccountPresence(["ADMINISTRATOR"])).toBe(true);
    expect(canViewAccountPresence(["ADMIN_PUSAT"])).toBe(true);
    expect(canViewAccountPresence(["ADMIN"])).toBe(true);
    expect(canViewAccountPresence(["ADMIN_BRANCH"])).toBe(true);
    expect(canViewAccountPresence(["ADMIN_DOJO"])).toBe(false);
    expect(canViewAccountPresence(["ADMIN_PROVINCE"])).toBe(false);
    expect(canViewAccountPresence(["MEMBER"])).toBe(false);
  });

  it("formats relative time in Indonesian", () => {
    const now = Date.now();
    expect(formatRelativeId(null, now)).toBe("—");
    expect(formatRelativeId(new Date(now - 10_000).toISOString(), now)).toBe(
      "baru saja",
    );
    expect(formatRelativeId(new Date(now - 3 * 60_000).toISOString(), now)).toBe(
      "3 menit lalu",
    );
  });

  it("uses 5 minute online threshold", () => {
    expect(ONLINE_THRESHOLD_MS).toBe(5 * 60 * 1000);
  });
});
