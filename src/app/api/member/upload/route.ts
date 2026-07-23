import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { isBlobUploadConfigured, uploadAdminFile } from "@/lib/upload";

export async function GET() {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ configured: isBlobUploadConfigured() });
}

export async function POST(request: Request) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const folderRaw = String(form.get("folder") || "photo").toLowerCase();
  const allowed = new Set([
    "photo",
    "akte",
    "bpjs",
    "iuran",
    "piagam",
    "members/akte",
    "members/bpjs",
  ]);
  if (!allowed.has(folderRaw)) {
    return NextResponse.json(
      { error: "Folder unggah tidak diizinkan" },
      { status: 400 },
    );
  }
  const folder =
    folderRaw === "members/akte"
      ? "akte"
      : folderRaw === "members/bpjs"
        ? "bpjs"
        : folderRaw;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
  }

  try {
    const result = await uploadAdminFile(file, `member/${folder}`);
    return NextResponse.json({
      success: true,
      url: result.url,
      pathname: result.pathname,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengunggah file";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
