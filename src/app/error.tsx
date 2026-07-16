"use client";

import { useEffect } from "react";
import { SegmentErrorPanel } from "@/components/SegmentErrorPanel";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <SegmentErrorPanel
      title="Gagal memuat halaman"
      error={error}
      reset={reset}
      homeHref="/"
      homeLabel="Beranda"
    />
  );
}
