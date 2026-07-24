import { findUserIdsManagingDojo } from "@/lib/managed-dojos";
import { notifyUser } from "@/lib/notifications";

/** Notifikasi setelah check-in absensi sukses (fire-and-forget aman). */
export async function notifyAttendanceCheckIn(opts: {
  token: string;
  memberUserId: string;
  memberName: string;
  dojoId: string;
  dojoName: string;
  biometric?: boolean;
}) {
  const place = opts.dojoName || "dojo";
  const bioNote = opts.biometric ? " (biometrik)" : "";

  try {
    await notifyUser({
      userId: opts.memberUserId,
      title: "Absensi tercatat",
      content: `Absensi Anda tercatat di ${place}${bioNote}.`,
      type: "SUCCESS",
      token: opts.token,
      audience: "MEMBER",
      email: false,
    });
  } catch (error) {
    console.error("[attendance-notify:member]", error);
  }

  try {
    const adminIds = await findUserIdsManagingDojo(opts.dojoId);
    const targets = adminIds.filter((id) => id !== opts.memberUserId).slice(0, 20);
    await Promise.allSettled(
      targets.map((userId) =>
        notifyUser({
          userId,
          title: "Absensi anggota",
          content: `${opts.memberName} absen di ${place}${bioNote}.`,
          type: "INFO",
          token: opts.token,
          audience: "ADMIN",
          email: false,
        }),
      ),
    );
  } catch (error) {
    console.error("[attendance-notify:admins]", error);
  }
}
