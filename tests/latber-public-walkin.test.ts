import { describe, expect, it } from "vitest";
import { uniqueTailFromNia } from "@/lib/latber-unique-tail";
import { parseMemberCardScanPayload } from "@/lib/latber-card-scan";

describe("uniqueTailFromNia", () => {
  it("takes last 3 digits", () => {
    expect(uniqueTailFromNia("36.12312")).toBe(312);
    expect(uniqueTailFromNia("123012")).toBe(12);
  });

  it("rejects 000 and empty", () => {
    expect(uniqueTailFromNia("ABC000")).toBeNull();
    expect(uniqueTailFromNia("")).toBeNull();
    expect(uniqueTailFromNia(null)).toBeNull();
  });
});

describe("parseMemberCardScanPayload", () => {
  it("parses /v/ paths and URLs", () => {
    expect(parseMemberCardScanPayload("https://inkai-sby.vercel.app/v/36.12345")).toBe(
      "36.12345",
    );
    expect(parseMemberCardScanPayload("/v/abc-uuid")).toBe("abc-uuid");
    expect(parseMemberCardScanPayload("36.12345")).toBe("36.12345");
  });
});
