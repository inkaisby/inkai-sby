import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PesanClient } from "@/components/member/PesanClient";

export const dynamic = "force-dynamic";

export default async function PesanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <PesanClient />;
}
