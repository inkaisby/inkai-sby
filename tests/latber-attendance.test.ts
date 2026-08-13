import { describe, expect, it } from "vitest";

import {
  isLatberAttendanceMethod,
  isLatberEventDayReached,
  mergeAttendanceWithLatberCredits,
  type LatberAttendanceCreditRow,
} from "../src/lib/latber-attendance";

describe("latber attendance credit", () => {
  it("isLatberEventDayReached memakai hari Jakarta", () => {
    expect(isLatberEventDayReached("2026-08-13T01:00:00.000Z", new Date("2026-08-13T10:00:00.000Z"))).toBe(
      true,
    );
    expect(isLatberEventDayReached("2026-08-20T01:00:00.000Z", new Date("2026-08-13T10:00:00.000Z"))).toBe(
      false,
    );
  });

  it("merge: GPS menang di hari yang sama, LATBER mengisi hari kosong", () => {
    const inkai = [
      {
        id: "gps-1",
        checkInAt: "2026-08-13T01:00:00.000Z",
        method: "GPS",
        dojo: { name: "GADING" },
      },
    ];
    const credits: LatberAttendanceCreditRow[] = [
      {
        id: "latber-1",
        memberId: "m1",
        dojoId: "d1",
        eventId: "e1",
        checkInAt: new Date("2026-08-13T08:00:00.000Z"),
        method: "LATBER",
        dojoName: "GADING",
        eventTitle: "Latihan Bersama — persiapan UKT",
      },
      {
        id: "latber-2",
        memberId: "m1",
        dojoId: "d1",
        eventId: "e2",
        checkInAt: new Date("2026-08-01T08:00:00.000Z"),
        method: "LATBER",
        dojoName: "GADING",
        eventTitle: "Latihan Bersama — Juli",
      },
    ];
    const merged = mergeAttendanceWithLatberCredits(inkai, credits);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe("gps-1");
    expect(merged[1]?.id).toBe("latber-2");
    expect(merged[1]?.method).toBe("LATBER");
  });

  it("isLatberAttendanceMethod mengenali LATBER", () => {
    expect(isLatberAttendanceMethod("LATBER")).toBe(true);
    expect(isLatberAttendanceMethod("GPS")).toBe(false);
  });
});
