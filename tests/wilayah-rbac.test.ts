import { describe, expect, it } from "vitest";
import {
  canEditMemberIdentity,
  isCabangAdmin,
  isNationalAdmin,
  isRantingAdmin,
} from "../src/lib/wilayah-rbac";

describe("canEditMemberIdentity", () => {
  it("allows national admin roles", () => {
    expect(canEditMemberIdentity(["ADMINISTRATOR"])).toBe(true);
    expect(canEditMemberIdentity(["ADMIN_PUSAT"])).toBe(true);
    expect(canEditMemberIdentity(["ADMIN"])).toBe(true);
  });

  it("allows branch admin role", () => {
    expect(canEditMemberIdentity(["ADMIN_BRANCH"])).toBe(true);
  });

  it("allows dojo / ranting admin role", () => {
    expect(canEditMemberIdentity(["ADMIN_DOJO"])).toBe(true);
  });

  it("rejects province admin and member roles", () => {
    expect(canEditMemberIdentity(["ADMIN_PROVINCE"])).toBe(false);
    expect(canEditMemberIdentity(["MEMBER"])).toBe(false);
    expect(canEditMemberIdentity([])).toBe(false);
  });
});
