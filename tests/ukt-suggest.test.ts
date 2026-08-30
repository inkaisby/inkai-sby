import { describe, expect, it, vi } from "vitest";
import {
  attachSuggestRegistrationFlags,
  buildMemberEventRegistrationMap,
  inkaiMemberDojoName,
  mergeSuggestDojoNames,
} from "@/lib/ukt-suggest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eventRegistration: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("ukt suggest helpers", () => {
  it("reads dojo name from nested Inkai payload", () => {
    expect(
      inkaiMemberDojoName({
        id: "1",
        dojo: { name: "KAI - ZEN" },
      }),
    ).toBe("KAI - ZEN");
    expect(inkaiMemberDojoName({ id: "1", dojoName: "  FORTRESS  " })).toBe(
      "FORTRESS",
    );
  });

  it("hydrates empty dojoName from Prisma map", () => {
    const merged = mergeSuggestDojoNames(
      [
        { id: "a", dojoName: "" },
        { id: "b", dojoName: "SUDAH ADA" },
      ],
      new Map([["a", "MANYAR"]]),
    );
    expect(merged[0].dojoName).toBe("MANYAR");
    expect(merged[1].dojoName).toBe("SUDAH ADA");
  });

  it("marks active UKT registration and ignores cancelled", () => {
    const flagged = attachSuggestRegistrationFlags(
      [{ id: "m1" }, { id: "m2" }],
      [
        { memberId: "m1", eventId: "ukt-1" },
        { memberId: "m2", eventId: "other" },
      ],
      "ukt-1",
      "latber-1",
    );
    expect(flagged[0].registeredUkt).toBe(true);
    expect(flagged[0].registeredLatber).toBe(false);
    expect(flagged[1].registeredUkt).toBe(false);
  });

  it("buildMemberEventRegistrationMap batches flags per member", async () => {
    vi.mocked(prisma.eventRegistration.findMany).mockResolvedValue([
      { memberId: "m1", eventId: "ukt-1" },
      { memberId: "m2", eventId: "lat-1" },
    ] as never);

    const map = await buildMemberEventRegistrationMap(
      ["m1", "m2", "m3"],
      "ukt-1",
      "lat-1",
    );

    expect(map.get("m1")).toEqual({ ukt: true, latber: false });
    expect(map.get("m2")).toEqual({ ukt: false, latber: true });
    expect(map.get("m3")).toEqual({ ukt: false, latber: false });
  });
});
