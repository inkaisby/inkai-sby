import { describe, expect, it } from "vitest";
import {
  normalizeMemberPhotoUrl,
  resolveMemberPhotoUrl,
} from "../src/lib/member-photo";

describe("member photo URL", () => {
  it("trims URLs and treats whitespace as missing", () => {
    expect(normalizeMemberPhotoUrl("  https://blob.test/foto.webp  ")).toBe(
      "https://blob.test/foto.webp",
    );
    expect(normalizeMemberPhotoUrl("   ")).toBeNull();
  });

  it("prioritizes Member photo over User and Inkai fallbacks", () => {
    expect(
      resolveMemberPhotoUrl(
        "https://blob.test/member.webp",
        "https://blob.test/user.webp",
        "https://inkai.test/old.webp",
      ),
    ).toBe("https://blob.test/member.webp");
  });

  it("skips empty values when selecting a fallback", () => {
    expect(
      resolveMemberPhotoUrl(" ", "", " https://inkai.test/foto.webp "),
    ).toBe("https://inkai.test/foto.webp");
  });
});
