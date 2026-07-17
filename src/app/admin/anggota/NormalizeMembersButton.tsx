"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, Wand2 } from "lucide-react";

export function NormalizeMembersButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    if (
      !window.confirm(
        "Normalisasi sabuk & jenis kelamin anggota (mis. Putih → Putih (Kyu 10), MALE → L)?",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members/normalize", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal normalisasi");
        return;
      }
      showSuccess(data.message || "Normalisasi selesai");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="gap-1.5"
      disabled={loading}
      onClick={() => void run()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Wand2 className="h-4 w-4" />
      )}
      Normalisasi sabuk/JK
    </Button>
  );
}
