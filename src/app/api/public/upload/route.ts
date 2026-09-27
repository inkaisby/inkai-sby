import { NextResponse } from "next/server";
import { isUploadConfigured, uploadAdminFile } from "@/lib/upload";

export async function GET() {
  return NextResponse.json({ configured: isUploadConfigured() });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") || "pertandingan").toLowerCase();

    const allowedFolders = new Set(["photo", "akte", "bpjs", "pertandingan"]);
    const folder = allowedFolders.has(folderRaw) ? folderRaw : "pertandingan";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
    }

    const result = await uploadAdminFile(file, `public/${folder}`);
    return NextResponse.json({
      success: true,
      url: result.url,
      pathname: result.pathname,
    });
  } catch (error: any) {
    console.error("POST /api/public/upload error:", error);
    const message = error instanceof Error ? error.message : "Gagal mengunggah file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
