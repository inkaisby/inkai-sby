"use client";

import { useEffect } from "react";
import { SegmentErrorPanel } from "@/components/SegmentErrorPanel";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <SegmentErrorPanel
      title="Gagal memuat Dashboard"
      error={error}
      reset={reset}
      homeHref="/dashboard"
      homeLabel="Beranda Dashboard"
    />
  );
}
