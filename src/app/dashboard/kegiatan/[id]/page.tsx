import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect, notFound } from "next/navigation";
import { getEventDetail } from "@/lib/public-data";
import {
  fetchMyBillings,
  fetchMyEventRegistrations,
  fetchMyMemberProfile,
} from "@/lib/inkai-api/member-data";
import { getEventRegistrationGate } from "@/lib/memberCompleteness";
import { ImpersonationDataNotice } from "@/components/member/ImpersonationDataNotice";
import { EventRegisterClient } from "./EventRegisterClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function MemberEventDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const { id } = await params;
  const [event, member, billings, registrations] = await Promise.all([
    getEventDetail(id),
    fetchMyMemberProfile(token),
    fetchMyBillings(token, 50),
    fetchMyEventRegistrations(token),
  ]);

  if (!event) notFound();

  const impersonating = Boolean(session.impersonatorId);

  const gateReason = getEventRegistrationGate({
    member: member
      ? {
          fullName: member.fullName as string | null,
          phoneNumber: member.phoneNumber as string | null,
          photoUrl: member.photoUrl as string | null,
          gender: member.gender as string | null,
          birthDate: member.birthDate as string | null,
          birthPlace: member.birthPlace as string | null,
          address: member.address as string | null,
          dojoId: member.dojoId as string | null,
          birthCertificateUrl: member.birthCertificateUrl as string | null,
          bpjsCardUrl: member.bpjsCardUrl as string | null,
          allowEventWithoutDues: member.allowEventWithoutDues as
            | boolean
            | null,
        }
      : null,
    billings: billings.map((b) => ({
      type: String(b.type ?? ""),
      status: String(b.status ?? ""),
    })),
  });

  const alreadyRegistered = registrations.some((r) => {
    const ev = r.event as { id?: string } | undefined;
    return String(ev?.id ?? r.eventId) === id;
  });

  return (
    <>
      {impersonating ? (
        <div className="mb-4">
          <ImpersonationDataNotice description="Kelayakan pendaftaran (profil, dokumen, iuran) tidak dapat diverifikasi dalam mode ambil alih, sehingga pendaftaran kegiatan diblokir sementara. Hentikan ambil alih untuk mendaftarkan anggota ini." />
        </div>
      ) : null}
      <EventRegisterClient
        event={event}
        gateReason={gateReason}
        alreadyRegistered={alreadyRegistered}
      />
    </>
  );
}
