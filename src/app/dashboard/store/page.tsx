import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { StoreClient } from "@/components/member/StoreClient";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  return <StoreClient />;
}
