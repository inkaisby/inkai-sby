import { NextResponse } from "next/server";
import { isCurrentlyImpersonating } from "@/lib/security/impersonation";

/** Blokir mutasi sensitif (password/email) saat mode ambil alih. */
export async function forbidIfImpersonating() {
  if (await isCurrentlyImpersonating()) {
    return NextResponse.json(
      {
        error:
          "Tidak dapat mengubah password/email saat mode ambil alih. Hentikan ambil alih terlebih dahulu.",
      },
      { status: 403 },
    );
  }
  return null;
}
