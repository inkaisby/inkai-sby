import { describe, expect, it, afterEach } from "vitest";
import {
  consumeMemoryDbTouch,
  lastSeenWriteCutoff,
  resetMemoryDbTouchStoreForTests,
  shouldAllowDbLastSeenWrite,
} from "../src/lib/presence-db";
import {
  DB_LAST_SEEN_THROTTLE_MS,
  PRESENCE_HEARTBEAT_RATE_MAX,
} from "../src/lib/presence-constants";

describe("presence-db", () => {
  afterEach(() => {
    resetMemoryDbTouchStoreForTests();
  });

  it("computes cutoff from stamp and throttle", () => {
    const stamp = new Date("2026-08-18T10:00:00.000Z");
    const cutoff = lastSeenWriteCutoff(stamp, 180_000);
    expect(cutoff.toISOString()).toBe("2026-08-18T09:57:00.000Z");
  });

  it("allows write when lastSeenAt is null or stale", () => {
    const stamp = new Date("2026-08-18T10:00:00.000Z");
    expect(shouldAllowDbLastSeenWrite(null, stamp, 180_000)).toBe(true);
    expect(
      shouldAllowDbLastSeenWrite(
        new Date("2026-08-18T09:00:00.000Z"),
        stamp,
        180_000,
      ),
    ).toBe(true);
    expect(
      shouldAllowDbLastSeenWrite(
        new Date("2026-08-18T09:59:00.000Z"),
        stamp,
        180_000,
      ),
    ).toBe(false);
  });

  it("throttles in-memory db touch per user", () => {
    const t0 = 1_000_000;
    expect(consumeMemoryDbTouch("u1", t0, 60_000)).toBe(true);
    expect(consumeMemoryDbTouch("u1", t0 + 30_000, 60_000)).toBe(false);
    expect(consumeMemoryDbTouch("u1", t0 + 60_001, 60_000)).toBe(true);
    expect(consumeMemoryDbTouch("u2", t0, 60_000)).toBe(true);
  });
});

describe("presence-constants throttle", () => {
  it("uses 3 minute db throttle and 8 heartbeat requests per minute", () => {
    expect(DB_LAST_SEEN_THROTTLE_MS).toBe(180_000);
    expect(PRESENCE_HEARTBEAT_RATE_MAX).toBe(8);
  });
});
