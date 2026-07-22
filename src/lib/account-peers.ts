import { prisma } from "@/lib/prisma";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import {
  findUserIdsManagingDojo,
  getManagedDojoIdsFromUser,
  loadManagedDojoIds,
} from "@/lib/managed-dojos";

export type AccountPeer = {
  userId: string;
  email: string;
  fullName: string | null;
  /** Nama ranting yang overlap dengan akun aktif. */
  dojoNames: string[];
  isCurrent: boolean;
};

/**
 * Akun ADMIN_DOJO yang berbagi ranting kelola (multi-ranting / PIC per ranting).
 * Dipakai di topbar untuk daftar email gabungan + ganti akun cepat.
 */
export async function loadAccountPeers(
  user: SessionUser,
): Promise<AccountPeer[]> {
  const role = getPrimaryAdminRole(user.roles);
  if (role !== "ADMIN_DOJO") return [];

  const myDojoIds = getManagedDojoIdsFromUser(user);
  if (myDojoIds.length === 0) return [];

  const peerIdSet = new Set<string>([user.id]);
  const idLists = await Promise.all(
    myDojoIds.map((dojoId) => findUserIdsManagingDojo(dojoId)),
  );
  for (const ids of idLists) {
    for (const id of ids) peerIdSet.add(id);
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: [...peerIdSet] },
      isDeleted: false,
      isActive: true,
      roles: { some: { name: "ADMIN_DOJO" } },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      managedDojoId: true,
    },
    orderBy: { email: "asc" },
  });

  if (users.length === 0) return [];

  const dojos = await prisma.dojo.findMany({
    where: { id: { in: myDojoIds }, isDeleted: false },
    select: { id: true, name: true },
  });
  const dojoNameById = new Map(dojos.map((d) => [d.id, d.name]));

  const peers: AccountPeer[] = [];
  for (const u of users) {
    const managed = await loadManagedDojoIds(u.id, u.managedDojoId);
    const overlap = managed.filter((id) => myDojoIds.includes(id));
    // Tetap tampilkan akun saat ini meski overlap kosong (edge case)
    if (u.id !== user.id && overlap.length === 0) continue;
    peers.push({
      userId: u.id,
      email: u.email,
      fullName: u.fullName,
      dojoNames: (u.id === user.id ? myDojoIds : overlap)
        .map((id) => dojoNameById.get(id) || id)
        .filter(Boolean),
      isCurrent: u.id === user.id,
    });
  }

  // Urut: akun aktif dulu, lalu email A-Z
  peers.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return a.email.localeCompare(b.email, "id");
  });

  return peers;
}
