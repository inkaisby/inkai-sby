import { inkaiFetch } from "@/lib/inkai-api/server";
import { notifyUser } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { latberDisplayStatusLabel, type LatberDisplayStatus } from "@/lib/latber";

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

export async function notifyLatberMember(opts: {
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
    console.error("[notifyLatberMember]", error);
  }
}

export async function notifyLatberStatusChange(opts: {
  token: string;
  memberId: string;
  memberName: string;
  periodTitle: string;
  displayStatus: LatberDisplayStatus;
  extra?: string;
}) {
  const label = latberDisplayStatusLabel(opts.displayStatus);
  await notifyLatberMember({
    token: opts.token,
    memberId: opts.memberId,
    title: `Latihan Bersama — ${label}`,
    content: `${opts.memberName}: status Latihan Bersama ${opts.periodTitle} diperbarui menjadi ${label}.${opts.extra ? ` ${opts.extra}` : ""}`,
    type:
      opts.displayStatus === "lunas"
        ? "SUCCESS"
        : opts.displayStatus === "ditolak"
          ? "WARNING"
          : "INFO",
  });
}
