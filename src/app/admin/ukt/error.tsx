"use client";

import { useEffect } from "react";
import { SegmentErrorPanel } from "@/components/SegmentErrorPanel";

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

  return (
    <SegmentErrorPanel
      title="Gagal memuat halaman UKT"
      error={error}
      reset={reset}
      homeHref="/admin"
      homeLabel="Beranda Admin"
    />
  );
}
