import { describe, expect, it } from "vitest";
import {
  buildLocationLabel,
  deviceSummary,
  parseUserAgent,
} from "../src/lib/session-audit-parse";

describe("session-audit", () => {
  it("parses desktop chrome on windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    const parsed = parseUserAgent(ua);
    expect(parsed.deviceType).toBe("Desktop");
    expect(parsed.os).toBe("Windows 10/11");
    expect(parsed.browser).toMatch(/^Chrome 131/);
  });

  it("parses mobile safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
    const parsed = parseUserAgent(ua);
    expect(parsed.deviceType).toBe("Mobile");
    expect(parsed.os).toMatch(/^iOS/);
    expect(parsed.browser).toMatch(/^Safari/);
  });

  it("builds location and device labels", () => {
    expect(
      buildLocationLabel({ city: "Surabaya", region: "JI", country: "Indonesia" }),
    ).toBe("Surabaya, JI, Indonesia");
    expect(
      deviceSummary({
        deviceType: "Desktop",
        browser: "Chrome 131",
        os: "Windows 10/11",
      }),
    ).toBe("Desktop · Chrome 131 · Windows 10/11");
  });
});
