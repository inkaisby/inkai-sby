import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/member-profile-locks";

export const EMAIL_TAKEN_MESSAGE =
  "Email sudah terdaftar. Silakan login atau hubungi pengurus ranting jika akun belum diverifikasi.";

export async function findExistingUserByEmail(
  email: string,
): Promise<{ isActive: boolean } | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const user = await prisma.user.findFirst({
    where: { email: normalized, isDeleted: false },
    select: { isActive: true },
  });
  if (!user) return null;
  return { isActive: user.isActive };
}
