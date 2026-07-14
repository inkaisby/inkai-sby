import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfilPageClient from "./ProfilPageClient";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const member = session.user.memberId
    ? await prisma.member.findFirst({
        where: { id: session.user.memberId, isDeleted: false },
        include: { user: { select: { phoneNumber: true } } },
      })
    : null;

  if (!member) redirect("/dashboard");

  return (
    <ProfilPageClient
      member={{
        ...member,
        phoneNumber: member.user?.phoneNumber,
      }}
    />
  );
}
