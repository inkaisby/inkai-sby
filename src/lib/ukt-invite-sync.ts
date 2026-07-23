import {
  buildUktInviteSnapshot,
  syncUktInviteSnapshot,
} from "@/lib/ukt-invite";
import type { UktPeriodMeta } from "@/lib/ukt";

/** Sinkron snapshot undangan publik setelah meta/event periode berubah. */
export async function syncInviteAfterPeriodChange(opts: {
  periodId: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationCloseAt?: string | null;
  location?: string | null;
  meta: UktPeriodMeta;
}): Promise<void> {
  try {
    await syncUktInviteSnapshot({
      periodId: opts.periodId,
      title: opts.title,
      startDate: opts.startDate,
      endDate: opts.endDate,
      registrationCloseAt: opts.registrationCloseAt,
      location: opts.location,
      meta: opts.meta,
    });
  } catch (error) {
    console.error("[syncInviteAfterPeriodChange]", opts.periodId, error);
  }
}

export function inviteSnapshotFromEventAndMeta(
  periodId: string,
  event: Record<string, unknown>,
  meta: UktPeriodMeta,
) {
  return buildUktInviteSnapshot({
    periodId,
    title: String(event.title ?? "UKT"),
    startDate: event.startDate ? String(event.startDate) : null,
    endDate: event.endDate ? String(event.endDate) : null,
    registrationCloseAt: event.registrationCloseAt
      ? String(event.registrationCloseAt)
      : null,
    location: event.location ? String(event.location) : null,
    meta,
  });
}
