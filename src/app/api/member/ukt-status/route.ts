import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { resolveUktRankColumns } from "@/lib/belt";
import {
  buildUktEventTitle,
  buildUktExamResultMap,
  currentSemester,
  findUktPeriodForTerm,
  parseUktEventTitle,
  resolveUktDisplayStatus,
  uktDisplayStatusLabel,
  type UktMemberRow,
} from "@/lib/ukt";
import { fetchSettingsByPrefix } from "@/lib/inkai-api/admin-data";
import { loadUktPeriodMeta } from "@/lib/ukt-period-meta-store";

function filterUktEvents(events: Array<Record<string, unknown>>) {
  return events.filter((e) => String(e.title).toUpperCase().includes("UKT"));
}

export async function GET() {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = await getInkaiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = new Date().getFullYear();
  const activeSemester = currentSemester();

  const { res, data } = await inkaiFetch("/v1/events?limit=40", {}, token);
  if (!res.ok) {
    return NextResponse.json({ period: null, status: null });
  }

  const periods = filterUktEvents((data.data as Array<Record<string, unknown>>) ?? []).map((p) => ({
    id: String(p.id),
    title: String(p.title),
    startDate: String(p.startDate),
    endDate: String(p.endDate),
    registrationCloseAt: p.registrationCloseAt ? String(p.registrationCloseAt) : null,
  }));

  const match =
    findUktPeriodForTerm(periods, activeSemester, year) ??
    periods.find((p) => parseUktEventTitle(p.title)?.year === year) ??
    null;

  if (!match) {
    return NextResponse.json({
      period: {
        title: buildUktEventTitle(activeSemester, year),
        semester: activeSemester,
        year,
      },
      registered: false,
      statusLabel: "Periode belum dibuka",
      displayStatus: "belum_daftar",
    });
  }

  const periodMeta = await loadUktPeriodMeta(token, match.id);
  const examPayload = {
    examAt: periodMeta.examAt ?? null,
    examLocation: periodMeta.examLocation ?? null,
  };

  const { res: detailRes, data: detailData } = await inkaiFetch(
    `/v1/events/${match.id}`,
    {},
    token,
  );
  if (!detailRes.ok) {
    return NextResponse.json({
      period: match,
      registered: false,
      statusLabel: "—",
      ...examPayload,
    });
  }

  const event = detailData.data as Record<string, unknown>;
  const registrations = (event.registrations as Array<Record<string, unknown>>) ?? [];
  const reg = registrations.find(
    (r) => String((r.member as { id?: string })?.id ?? r.memberId) === session.user.memberId,
  );

  if (!reg) {
    return NextResponse.json({
      period: match,
      registered: false,
      statusLabel: "Belum terdaftar",
      displayStatus: "belum_daftar",
      ...examPayload,
    });
  }

  const examSettings = await fetchSettingsByPrefix(token, `ukt-exam-result:${match.id}:`);
  const examMap = buildUktExamResultMap(examSettings, match.id);
  const member = reg.member as Record<string, unknown> | undefined;
  const billings = (member?.billings as Array<Record<string, unknown>>) ?? [];
  const billing = billings.find((b) => b.registrationId === reg.id) ?? billings[0];
  const category = reg.category as { name?: string } | null | undefined;
  const { kyuLama, kyuBaru } = resolveUktRankColumns(
    typeof reg.registeredRank === "string" ? reg.registeredRank : null,
    member?.currentRank ? String(member.currentRank) : null,
    category?.name,
  );

  const row: UktMemberRow = {
    memberId: session.user.memberId,
    registrationId: String(reg.id),
    photoUrl: null,
    nia: null,
    fullName: String(member?.fullName ?? session.user.name ?? ""),
    birthPlace: null,
    birthDate: null,
    gender: null,
    address: null,
    kyuLama,
    kyuBaru,
    birthCertificateUrl: null,
    bpjsCardUrl: null,
    dojoName: "—",
    dojoId: "",
    status: String(reg.status ?? ""),
    billingId: billing?.id ? String(billing.id) : null,
    billingStatus: billing?.status ? String(billing.status) : null,
    billingAmount: billing?.amount != null ? Number(billing.amount) : null,
    outstandingDues: 0,
    pendingVerifications: 0,
    attendanceCount: 0,
    attendancePct: null,
    examResult: examMap.get(String(reg.id)) ?? null,
    examPresent: null,
  };

  const displayStatus = resolveUktDisplayStatus(row);

  return NextResponse.json({
    period: match,
    registered: true,
    registrationId: row.registrationId,
    kyuLama: row.kyuLama,
    kyuBaru: row.kyuBaru,
    displayStatus,
    statusLabel: uktDisplayStatusLabel(displayStatus),
    examResult: row.examResult,
    ...examPayload,
  });
}
