import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import {
  fetchMyBillings,
  fetchMyMemberProfile,
} from "@/lib/inkai-api/member-data";
import { getEventRegistrationGate } from "@/lib/memberCompleteness";

export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = await getInkaiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventId = body?.eventId as string | undefined;
  const categoryId = body?.categoryId as string | undefined;
  if (!eventId) {
    return NextResponse.json({ error: "eventId wajib" }, { status: 400 });
  }

  const [member, billings] = await Promise.all([
    fetchMyMemberProfile(token),
    fetchMyBillings(token, 50),
  ]);

  const gate = getEventRegistrationGate({
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
          allowEventWithoutDues: member.allowEventWithoutDues as boolean | null,
        }
      : null,
    billings: billings.map((b) => ({
      type: String(b.type ?? ""),
      status: String(b.status ?? ""),
    })),
  });

  if (gate) {
    return NextResponse.json(
      {
        error:
          gate === "profile"
            ? "Profil belum lengkap"
            : gate === "documents"
              ? "Dokumen belum lengkap"
              : "Iuran bulanan belum lunas",
        gate,
      },
      { status: 403 },
    );
  }

  const payload: Record<string, string> = {
    eventId,
    memberId: session.user.memberId,
  };
  if (categoryId) payload.categoryId = categoryId;

  const { res, data } = await inkaiFetch(
    "/v1/events/register",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal mendaftar kegiatan") },
      { status: res.status },
    );
  }

  return NextResponse.json({ success: true, data: data.data });
}
