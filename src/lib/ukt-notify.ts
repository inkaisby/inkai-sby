import { inkaiFetch } from "@/lib/inkai-api/server";
import { notifyUser } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { uktDisplayStatusLabel, type UktDisplayStatus } from "@/lib/ukt";

async function resolveMemberUserId(
  token: string,
  memberId: string,
): Promise<string | null> {
  const local = await prisma.member.findFirst({
    where: { id: memberId, isDeleted: false },
    select: { userId: true },
  });
  if (local?.userId) return local.userId;

  const { res, data } = await inkaiFetch(`/v1/members/${memberId}`, {}, token);
  if (!res.ok) return null;
  const member = data.data as { user?: { id?: string }; userId?: string } | undefined;
  return member?.user?.id ?? member?.userId ?? null;
}

export async function notifyUktMember(opts: {
  token: string;
  memberId: string;
  title: string;
  content: string;
  type?: string;
}) {
  try {
    const userId = await resolveMemberUserId(opts.token, opts.memberId);
    if (!userId) return;
    await notifyUser({
      userId,
      title: opts.title,
      content: opts.content,
      type: opts.type ?? "INFO",
      token: opts.token,
    });
  } catch (error) {
    console.error("[notifyUktMember]", error);
  }
}

export async function notifyUktStatusChange(opts: {
  token: string;
  memberId: string;
  memberName: string;
  periodTitle: string;
  displayStatus: UktDisplayStatus;
  extra?: string;
}) {
  const label = uktDisplayStatusLabel(opts.displayStatus);
  await notifyUktMember({
    token: opts.token,
    memberId: opts.memberId,
    title: `UKT — ${label}`,
    content: `${opts.memberName}: status UKT ${opts.periodTitle} diperbarui menjadi ${label}.${opts.extra ? ` ${opts.extra}` : ""}`,
    type:
      opts.displayStatus === "selesai" || opts.displayStatus === "lulus"
        ? "SUCCESS"
        : opts.displayStatus === "gagal" || opts.displayStatus === "ditolak"
          ? "WARNING"
          : "INFO",
  });
}
