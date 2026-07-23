import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PesanClient } from "@/components/member/PesanClient";
import { loadMemberPesanInbox } from "@/lib/member-pesan";

export const dynamic = "force-dynamic";

export default async function PesanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const inbox = await loadMemberPesanInbox();
  return <PesanClient initial={inbox} />;
}
