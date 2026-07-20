import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getPrimaryAccountId,
  setPrimaryAccountId,
} from "@/lib/wilayah-accounts";

async function findDojoPic(dojoId: string) {
  const primaryId = await getPrimaryAccountId("dojo", dojoId);
  if (primaryId) {
    const primary = await prisma.user.findFirst({
      where: { id: primaryId, isDeleted: false },
      select: { id: true, email: true },
    });
    if (primary) return primary;
  }
  return prisma.user.findFirst({
    where: {
      managedDojoId: dojoId,
      isDeleted: false,
      roles: { some: { name: "ADMIN_DOJO" } },
    },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Email/password PIC ranting disimpan di Prisma (User.passwordHash).
 * Jangan kirim adminPassword ke Inkai PATCH dojo — API itu sering menolak
 * dengan pesan generik ("Data tidak valid password baru ranting").
 */
export async function upsertDojoPicCredentials(opts: {
  dojoId: string;
  email?: string;
  password?: string;
}): Promise<
  | { ok: true; email: string; created: boolean }
  | { ok: false; error: string; status: number }
> {
  const email = opts.email?.trim().toLowerCase() || "";
  const password = opts.password?.trim() || "";
  if (!email && !password) {
    return { ok: false, error: "Email atau password wajib diisi", status: 400 };
  }

  const pic = await findDojoPic(opts.dojoId);

  if (!pic) {
    if (!email || !password) {
      return {
        ok: false,
        error:
          "Ranting belum punya akun login. Isi email dan password, atau buat lewat tombol Akun.",
        status: 400,
      };
    }

    const conflict = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        isDeleted: false,
      },
      select: { id: true },
    });
    if (conflict) {
      return {
        ok: false,
        error: `Email ${email} sudah dipakai akun lain`,
        status: 409,
      };
    }

    const role = await prisma.role.findUnique({
      where: { name: "ADMIN_DOJO" },
      select: { id: true },
    });
    if (!role) {
      return { ok: false, error: "Role ADMIN_DOJO tidak ditemukan", status: 500 };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        isActive: true,
        managedDojoId: opts.dojoId,
        roles: { connect: [{ id: role.id }] },
      },
      select: { id: true, email: true },
    });
    await setPrimaryAccountId("dojo", opts.dojoId, created.id);
    return { ok: true, email: created.email, created: true };
  }

  if (email && email !== pic.email.toLowerCase()) {
    const conflict = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        isDeleted: false,
        NOT: { id: pic.id },
      },
      select: { id: true },
    });
    if (conflict) {
      return {
        ok: false,
        error: `Email ${email} sudah dipakai akun lain`,
        status: 409,
      };
    }
  }

  const data: { email?: string; passwordHash?: string } = {};
  if (email) data.email = email;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  const updated = await prisma.user.update({
    where: { id: pic.id },
    data,
    select: { email: true },
  });

  return { ok: true, email: updated.email, created: false };
}
