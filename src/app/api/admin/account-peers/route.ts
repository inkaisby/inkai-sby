import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { loadAccountPeers } from "@/lib/account-peers";

export const dynamic = "force-dynamic";

/** Daftar email akun ranting yang berbagi kelola multi-ranting dengan user aktif. */
export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  try {
    const peers = await loadAccountPeers(authResult.user);
    return NextResponse.json({
      success: true,
      peers,
      currentEmail: authResult.user.email ?? "",
    });
  } catch (error) {
    console.error("[account-peers]", error);
    return NextResponse.json(
      { error: "Gagal memuat akun gabungan" },
      { status: 500 },
    );
  }
}
