"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UktError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[UktError]", error);
  }, [error]);

  const isDbError =
    error.message.includes("max clients") ||
    error.message.includes("connection") ||
    error.message.includes("pool") ||
    error.message.includes("Timed out fetching");

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="size-10 text-destructive" />
      </div>
      <h2 className="mb-2 text-xl font-bold">Gagal memuat halaman UKT</h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {isDbError
          ? "Koneksi database sibuk. Tunggu beberapa detik lalu coba lagi."
          : "Terjadi kesalahan saat memuat data UKT."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset} className="bg-inkai-red hover:bg-inkai-red/90">
          Coba Lagi
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin">Beranda Admin</Link>
        </Button>
      </div>
    </div>
  );
}
