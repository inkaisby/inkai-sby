import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import ProfilPageClient from "./ProfilPageClient";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const member = await fetchMyMemberProfile(token);
  if (!member?.id) redirect("/dashboard");

  return (
    <ProfilPageClient
      member={{
        id: String(member.id),
        fullName: String(member.fullName ?? ""),
        nik: (member.nik as string | null) ?? null,
        gender: (member.gender as string | null) ?? null,
        birthDate: member.birthDate ? new Date(String(member.birthDate)) : null,
        address: (member.address as string | null) ?? null,
        phoneNumber: (member.phoneNumber as string | null) ?? null,
      }}
    />
  );
}
