import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import {
  findUserIdsManagingDojo,
  getManagedDojoIdsFromUser,
} from "@/lib/managed-dojos";
import { SITE_BRANCH_NAME } from "@/lib/site";
import { textMentionsDojo } from "@/lib/notification-display";

export {
  extractDojoLabelFromNotificationText,
  textMentionsDojo,
} from "@/lib/notification-display";

/**
 * Admin ranting hanya melihat notifikasi yang menyebut rantingnya
 * (atau tidak menyebut ranting lain di cabang yang sama).
 * Cabang / pusat: semua notifikasi tetap tampil.
 */
export async function filterNotificationsForAdminScope<
  T extends { title?: string | null; content?: string | null },
>(user: SessionUser, items: T[]): Promise<T[]> {
  const role = getPrimaryAdminRole(user.roles);
  if (role !== "ADMIN_DOJO") return items;

  const managedIds = getManagedDojoIdsFromUser(user);
  if (managedIds.length === 0) return items;

  const managed = await prisma.dojo.findMany({
    where: { id: { in: managedIds }, isDeleted: false },
    select: { id: true, name: true, branchId: true },
  });
  if (managed.length === 0) return items;

  const branchIds = [...new Set(managed.map((d) => d.branchId))];
  const siblings = await prisma.dojo.findMany({
    where: { branchId: { in: branchIds }, isDeleted: false },
    select: { id: true, name: true },
  });

  const managedIdSet = new Set(managed.map((d) => d.id));
  const managedNames = managed.map((d) => d.name);
  const otherNames = siblings
    .filter((d) => !managedIdSet.has(d.id))
    .map((d) => d.name);

  return items.filter((item) => {
    const text = `${item.title ?? ""} ${item.content ?? ""}`;
    const mentionsMine = managedNames.some((n) => textMentionsDojo(text, n));
    if (mentionsMine) return true;
    const mentionsOther = otherNames.some((n) => textMentionsDojo(text, n));
    return !mentionsOther;
  });
}

/** Notifikasi ke admin ranting pemilik dojo + admin cabang terkait. */
export async function notifyDojoAndBranchAdmins(opts: {
  dojoId: string;
  token: string;
  title: string;
  content: string;
  type?: string;
  /** Default false — hindari spam email massal. */
  email?: boolean;
}) {
  const dojo = await prisma.dojo.findFirst({
    where: { id: opts.dojoId, isDeleted: false },
    select: { id: true, name: true, branchId: true },
  });
  if (!dojo) return { sent: 0 };

  const [dojoAdminIds, branchAdmins] = await Promise.all([
    findUserIdsManagingDojo(dojo.id),
    prisma.user.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        OR: [
          {
            managedBranchId: dojo.branchId,
            roles: {
              some: { name: { in: ["ADMIN_BRANCH", "ADMIN"] } },
            },
          },
          {
            roles: {
              some: { name: { in: ["ADMINISTRATOR", "ADMIN_PUSAT"] } },
            },
            OR: [
              {
                managedBranch: {
                  name: {
                    equals: SITE_BRANCH_NAME,
                    mode: "insensitive",
                  },
                },
              },
              { managedBranchId: null },
            ],
          },
        ],
      },
      select: { id: true },
      take: 40,
    }),
  ]);

  const recipientIds = [
    ...new Set([...dojoAdminIds, ...branchAdmins.map((u) => u.id)]),
  ];

  const results = await Promise.allSettled(
    recipientIds.map((userId) =>
      notifyUser({
        userId,
        title: opts.title,
        content: opts.content,
        type: opts.type ?? "INFO",
        token: opts.token,
        email: opts.email ?? false,
      }),
    ),
  );

  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    dojoName: dojo.name,
  };
}

/** Notifikasi daftar mandiri kegiatan — hanya ranting anggota + cabang. */
export async function notifySelfEventRegistration(opts: {
  dojoId: string;
  memberName: string;
  eventLabel: string;
  token: string;
}) {
  const dojo = await prisma.dojo.findFirst({
    where: { id: opts.dojoId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!dojo) return { sent: 0 };

  const name = opts.memberName.trim() || "Anggota";
  const eventLabel = opts.eventLabel.trim() || "kegiatan";
  return notifyDojoAndBranchAdmins({
    dojoId: dojo.id,
    token: opts.token,
    title: "Anggota mendaftar kegiatan mandiri",
    content: `${name} (${dojo.name}) mendaftar sendiri untuk '${eventLabel}'.`,
    type: "INFO",
  });
}
