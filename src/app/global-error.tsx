"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="id">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center text-zinc-900">
        <div className="mb-4 rounded-full bg-red-50 p-4">
          <AlertTriangle className="size-10 text-red-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold">Terjadi gangguan</h2>
        <p className="mb-6 max-w-md text-sm text-zinc-600">
          Halaman gagal dimuat. Silakan coba lagi beberapa saat.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset} className="bg-[#c8102e] hover:bg-[#c8102e]/90">
            Coba Lagi
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Beranda</Link>
          </Button>
        </div>
      </body>
    </html>
  );
}
