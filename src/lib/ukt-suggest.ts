export type UktSuggestItem = {
  id: string;
  fullName: string;
  nia: string | null;
  dojoName?: string;
  currentRank?: string;
  registeredUkt?: boolean;
  registeredLatber?: boolean;
};

export function inkaiMemberDojoName(member: Record<string, unknown>): string | undefined {
  const flat = member.dojoName;
  if (typeof flat === "string" && flat.trim()) return flat.trim();
  const nested = member.dojo as { name?: unknown } | undefined;
  if (typeof nested?.name === "string" && nested.name.trim()) {
    return nested.name.trim();
  }
  return undefined;
}

export function mergeSuggestDojoNames<T extends { id: string; dojoName?: string }>(
  suggestions: T[],
  prismaDojoById: Map<string, string>,
): T[] {
  return suggestions.map((item) => {
    const fromPrisma = prismaDojoById.get(item.id);
    const current = item.dojoName?.trim();
    if (current) return item;
    if (fromPrisma) return { ...item, dojoName: fromPrisma };
    return item;
  });
}

export function attachSuggestRegistrationFlags<T extends { id: string }>(
  suggestions: T[],
  regs: Array<{ memberId: string; eventId: string }>,
  uktEventId?: string,
  latberEventId?: string,
): Array<T & { registeredUkt?: boolean; registeredLatber?: boolean }> {
  const uktIds = new Set(
    uktEventId
      ? regs.filter((r) => r.eventId === uktEventId).map((r) => r.memberId)
      : [],
  );
  const latberIds = new Set(
    latberEventId
      ? regs.filter((r) => r.eventId === latberEventId).map((r) => r.memberId)
      : [],
  );
  return suggestions.map((item) => ({
    ...item,
    ...(uktEventId ? { registeredUkt: uktIds.has(item.id) } : {}),
    ...(latberEventId ? { registeredLatber: latberIds.has(item.id) } : {}),
  }));
}
