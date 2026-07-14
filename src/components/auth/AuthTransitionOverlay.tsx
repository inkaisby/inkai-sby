"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { InkaiLoadingScreen } from "@/components/ui/InkaiLoadingScreen";

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
    document.body
  );
}
