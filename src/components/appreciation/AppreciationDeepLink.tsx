"use client";

import { useEffect } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/lib/client-toast";
import { cn } from "@/lib/utils";

/** Scroll ke entri saat deep-link ?tokoh= / hash. Ringan, sekali mount. */
export function AppreciationScrollTarget({
  targetId,
}: {
  targetId: string | null;
}) {
  useEffect(() => {
    if (!targetId) return;
    const el = document.getElementById(`apresiasi-${targetId}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
  }, [targetId]);

  return null;
}

export function AppreciationCopyLink({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  async function copy() {
    try {
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      showSuccess("Tautan disalin");
    } catch {
      showError("Gagal menyalin tautan");
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn(
        "h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={() => void copy()}
      aria-label="Salin tautan"
    >
      <Link2 className="h-3.5 w-3.5" />
      Salin tautan
    </Button>
  );
}
