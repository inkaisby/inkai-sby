"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { InkaiLoadingScreen } from "@/components/ui/InkaiLoadingScreen";

/**
 * Overlay logo INKAI — hanya mount saat aktif (tidak opacity-0 tersembunyi).
 * Dipakai login, logout, ganti akun, dan perpindahan portal.
 */
export function AuthTransitionOverlay({
  active,
  message,
}: {
  active: boolean;
  message: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!active || !mounted) return null;

  return createPortal(
    <InkaiLoadingScreen message={message} fullscreen />,
    document.body,
  );
}
