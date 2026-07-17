import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  fetchMyAttendance,
  fetchMyMemberProfile,
} from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { AttendanceCheckIn } from "@/components/member/AttendanceCheckIn";

export const dynamic = "force-dynamic";

export default async function AbsensiPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const [attendances, member] = await Promise.all([
    fetchMyAttendance(token, 50),
    fetchMyMemberProfile(token),
  ]);

  const dojoId =
    (member as { dojoId?: string } | null)?.dojoId ||
    ((member?.dojo as { id?: string } | undefined)?.id ?? null);

  return (
    <>
      <MemberPageHeader title="Absensi" />
      <AttendanceCheckIn defaultDojoId={dojoId} />

      <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Riwayat
      </h3>
      {attendances.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada riwayat absensi.
        </div>
      ) : (
        <div className="space-y-3">
          {attendances.map((a) => {
            const dojo = a.dojo as { name?: string } | undefined;
            const event = a.event as { title?: string } | null | undefined;
            return (
              <div
                key={String(a.id)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{dojo?.name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {event?.title || String(a.method ?? "—")}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {new Date(String(a.checkInAt)).toLocaleString("id-ID")}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
