import { describe, expect, it } from "vitest";
import {
  isPrismaBusyError,
  settingsUsernameLoadWarning,
} from "../src/lib/prisma-errors";

describe("isPrismaBusyError", () => {
  it("detects pool exhaustion messages", () => {
    expect(
      isPrismaBusyError(new Error("Timed out fetching a new connection from the connection pool")),
    ).toBe(true);
    expect(isPrismaBusyError("max clients reached")).toBe(true);
    expect(
      isPrismaBusyError(
        new Error("FATAL: (EMAXCONNSESSION) max clients reached in session mode"),
      ),
    ).toBe(true);
    expect(isPrismaBusyError("P2024: Timed out")).toBe(true);
    expect(isPrismaBusyError("Can't reach database server")).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isPrismaBusyError(new Error("Column foo does not exist"))).toBe(
      false,
    );
    expect(isPrismaBusyError("Invalid `prisma.user.findMany()`")).toBe(false);
  });
});

describe("settingsUsernameLoadWarning", () => {
  it("uses sibuk label for pool errors", () => {
    const msg = settingsUsernameLoadWarning(
      "ranting",
      new Error("connection pool timeout"),
    );
    expect(msg).toContain("database sibuk");
    expect(msg).toContain("ranting");
  });

  it("uses generic label for other errors", () => {
    const msg = settingsUsernameLoadWarning(
      "cabang",
      new Error("Column does not exist"),
    );
    expect(msg).toContain("gagal dimuat");
    expect(msg).not.toContain("database sibuk");
    expect(msg).toContain("cabang");
  });
});
