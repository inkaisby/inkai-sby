import { NextResponse } from "next/server";
import { inkaiFetch } from "@/lib/inkai-api/server";
import {
  formatUktRegistrationDeadline,
  getUktRegistrationDeadline,
  isUktRegistrationNotYetOpen,
  isUktRegistrationOpen,
} from "@/lib/ukt";
import {
  loadUktPeriodMeta,
  mergeUktPeriodMeta,
  saveUktPeriodMeta,
} from "@/lib/ukt-period-meta-store";
import { notifyUktDojoAdmins } from "@/lib/ukt-period-notify";

export const runtime = "nodejs";

function filterUktEvents(events: Array<Record<string, unknown>>) {
  return events.filter((e) => String(e.title ?? "").toUpperCase().includes("UKT"));
}

/**
 * Cron harian: (1) notifikasi buka pendaftaran saat waktunya tiba,
 * (2) pengingat H-3 sebelum batas tutup.
 * Auth: Authorization Bearer CRON_SECRET atau header x-cron-secret.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET belum di-set" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  const ok =
    auth === `Bearer ${secret}` || headerSecret === secret;
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceToken = process.env.INKAI_SERVICE_TOKEN || process.env.CRON_INKAI_TOKEN;
  if (!serviceToken) {
    return NextResponse.json(
      { error: "Token layanan (INKAI_SERVICE_TOKEN) belum di-set" },
      { status: 503 },
    );
  }

  const { res, data } = await inkaiFetch("/v1/events?limit=200", {}, serviceToken);
  if (!res.ok) {
    return NextResponse.json({ error: "Gagal memuat event" }, { status: 502 });
  }

  const periods = filterUktEvents((data.data as Array<Record<string, unknown>>) ?? []);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let opened = 0;
  let reminded = 0;

  for (const event of periods) {
    const eventId = String(event.id ?? "");
    if (!eventId) continue;
    const meta = await loadUktPeriodMeta(serviceToken, eventId);
    if (meta.archived || meta.locked) continue;

    const schedule = {
      startDate: String(event.startDate ?? ""),
      endDate: String(event.endDate ?? ""),
      registrationCloseAt: event.registrationCloseAt
        ? String(event.registrationCloseAt)
        : null,
      registrationOpenAt: meta.registrationOpenAt ?? null,
    };

    const title = String(event.title ?? "UKT");

    // Buka: sudah lewat openAt, masih sebelum close, belum pernah notifiedOpenAt
    if (
      !meta.notifiedOpenAt &&
      meta.registrationOpenAt &&
      !isUktRegistrationNotYetOpen(schedule) &&
      isUktRegistrationOpen(schedule)
    ) {
      await notifyUktDojoAdmins({
        token: serviceToken,
        title: `Pendaftaran UKT dibuka: ${title}`,
        content: `Pendaftaran ${title} sudah dibuka hingga ${formatUktRegistrationDeadline(getUktRegistrationDeadline(schedule).toISOString())}. Segera daftarkan anggota yang memenuhi syarat.`,
        type: "SUCCESS",
      });
      const next = mergeUktPeriodMeta(meta, {
        notifiedOpenAt: new Date().toISOString(),
        by: "cron",
      });
      await saveUktPeriodMeta(serviceToken, eventId, next);
      opened += 1;
      continue;
    }

    // H-3 reminder
    const closeAt = getUktRegistrationDeadline(schedule).getTime();
    const msLeft = closeAt - now;
    if (
      isUktRegistrationOpen(schedule) &&
      msLeft > 0 &&
      msLeft <= 3 * dayMs &&
      !meta.notifiedCloseReminderAt
    ) {
      await notifyUktDojoAdmins({
        token: serviceToken,
        title: `Pengingat: batas UKT ${title}`,
        content: `Pendaftaran ${title} ditutup ${formatUktRegistrationDeadline(getUktRegistrationDeadline(schedule).toISOString())} (H-${Math.max(1, Math.ceil(msLeft / dayMs))}). Pastikan peserta ranting sudah didaftarkan.`,
        type: "WARNING",
      });
      const latest = await loadUktPeriodMeta(serviceToken, eventId);
      const next = mergeUktPeriodMeta(latest, {
        notifiedCloseReminderAt: new Date().toISOString(),
        by: "cron",
      });
      await saveUktPeriodMeta(serviceToken, eventId, next);
      reminded += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: periods.length,
    opened,
    reminded,
    at: new Date().toISOString(),
  });
}
