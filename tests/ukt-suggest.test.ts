import { describe, expect, it } from "vitest";
import {
  attachSuggestRegistrationFlags,
  inkaiMemberDojoName,
  mergeSuggestDojoNames,
} from "@/lib/ukt-suggest";

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
});
