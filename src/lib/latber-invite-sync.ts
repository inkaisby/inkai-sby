import {
  buildLatberInviteSnapshot,
  syncLatberInviteSnapshot,
  type LatberInviteSnapshotInput,
} from "@/lib/latber-invite";

export async function syncInviteAfterLatberPeriodChange(opts: {
  periodId: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationCloseAt?: string | null;
  location?: string | null;
  meta: LatberInviteSnapshotInput["meta"];
  token?: string | null;
}): Promise<void> {
  try {
    await syncLatberInviteSnapshot(
      {
        periodId: opts.periodId,
        title: opts.title,
        startDate: opts.startDate,
        endDate: opts.endDate,
        registrationCloseAt: opts.registrationCloseAt,
        location: opts.location,
        meta: opts.meta,
      },
      opts.token,
    );
    buildLatberInviteSnapshot({
      periodId: opts.periodId,
      title: opts.title,
      startDate: opts.startDate,
      endDate: opts.endDate,
      registrationCloseAt: opts.registrationCloseAt,
      location: opts.location,
      meta: opts.meta,
    });
  } catch (error) {
    console.error("[syncInviteAfterLatberPeriodChange]", opts.periodId, error);
  }
}
