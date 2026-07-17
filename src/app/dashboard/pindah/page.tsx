import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { PindahDojoClient } from "@/components/member/PindahDojoClient";

export const dynamic = "force-dynamic";

export default async function PindahPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const member = await fetchMyMemberProfile(token);
  const dojoName =
    (member?.dojo as { name?: string } | undefined)?.name || "—";

  return <PindahDojoClient currentDojoName={dojoName} />;
}
