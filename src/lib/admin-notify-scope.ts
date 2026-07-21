import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import {
  findUserIdsManagingDojo,
  getManagedDojoIdsFromUser,
} from "@/lib/managed-dojos";
import { SITE_BRANCH_NAME } from "@/lib/site";
import { textMentionsDojo } from "@/lib/notification-display";
import {
  filterNotificationsForCurrentUser,
  isBranchWideAdminNotification,
  isMemberPersonalNotification,
  normalizeAudience,
  type NotifText,
} from "@/lib/notification-filters";

export {
  extractDojoLabelFromNotificationText,
  textMentionsDojo,
} from "@/lib/notification-display";

export {
  filterNotificationsForCurrentUser,
  filterNotificationsForMemberInbox,
  isAdminOpsNotification,
  isBranchWideAdminNotification,
  isMemberPersonalNotification,
  normalizeAudience,
  withFilterStats,
  type NotifText,
  type NotificationFilterStats,
} from "@/lib/notification-filters";

/**
 * Inbox admin:
 * - Semua role: hanya penerima yang benar; sembunyikan notif pribadi anggota.
 * - ADMIN_DOJO: hanya notif rantingnya + ops cabang untuk semua ranting.
 * - Cabang / pusat: tetap lihat semua ranting (setelah filter di atas).
 */
export async function filterNotificationsForAdminScope<
  T extends NotifText,
>(user: SessionUser, items: T[]): Promise<T[]> {
  let scoped = filterNotificationsForCurrentUser(user.id, items);

  scoped = scoped.filter((item) => {
    if (typeof item.userId === "string" && item.userId === user.id) {
      const audience = normalizeAudience(item.audience);
      if (audience === "ADMIN") return true;
      if (audience === "MEMBER") return false;
    }
    return !isMemberPersonalNotification(item);
  });

  const role = getPrimaryAdminRole(user.roles);
  if (role !== "ADMIN_DOJO") return scoped;

  const managedIds = getManagedDojoIdsFromUser(user);
  if (managedIds.length === 0) return scoped;

  const managed = await prisma.dojo.findMany({
    where: { id: { in: managedIds }, isDeleted: false },
    select: { id: true, name: true, branchId: true },
  });
  if (managed.length === 0) return scoped;

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

  return scoped.filter((item) => {
    if (typeof item.userId === "string" && item.userId === user.id) {
      return true;
    }
    const text = `${item.title ?? ""} ${item.content ?? ""}`;
    const mentionsMine = managedNames.some((n) => textMentionsDojo(text, n));
    if (mentionsMine) return true;
    const mentionsOther = otherNames.some((n) => textMentionsDojo(text, n));
    if (mentionsOther) return false;
    return isBranchWideAdminNotification(item);
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
        audience: "ADMIN",
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
