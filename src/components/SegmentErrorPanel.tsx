"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPrismaBusyError } from "@/lib/prisma-errors";

function classifyError(message: string) {
  const lower = message.toLowerCase();
  if (isPrismaBusyError(message)) {
    return "Koneksi database sibuk. Tunggu beberapa detik lalu coba lagi.";
  }
  if (
    lower.includes("timed out fetching inkai") ||
    lower.includes("aborted") ||
    lower.includes("fetch failed") ||
    lower.includes("inkai api") ||
    lower.includes("503")
  ) {
    return "Layanan sementara lambat/timeout. Tunggu sebentar lalu coba lagi.";
  }
  return "Terjadi gangguan sementara. Silakan coba lagi.";
}

export function SegmentErrorPanel({
  title,
  error,
  reset,
  homeHref = "/",
  homeLabel = "Beranda",
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="size-10 text-destructive" />
      </div>
      <h2 className="mb-2 text-xl font-bold">{title}</h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {classifyError(error.message || "")}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset} className="bg-inkai-red hover:bg-inkai-red/90">
          Coba Lagi
        </Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
