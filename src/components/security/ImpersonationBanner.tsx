"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner({
  targetName,
  targetEmail,
}: {
  targetName: string;
  targetEmail: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stop() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/impersonate/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Gagal menghentikan ambil alih");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Gagal menghentikan ambil alih");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 border-b border-red-800 bg-red-700 px-3 py-2 text-sm text-white sm:flex-row sm:items-center sm:justify-between sm:px-4"
    >
      <p className="min-w-0">
        Mode ambil alih aktif — Anda melihat sebagai{" "}
        <span className="font-semibold">{targetName || targetEmail}</span>
        {targetEmail ? (
          <span className="opacity-90"> ({targetEmail})</span>
        ) : null}
        . Perubahan sensitif (password/email) diblokir.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {error ? <span className="text-xs text-red-100">{error}</span> : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 bg-white text-red-800 hover:bg-red-50"
          disabled={pending}
          onClick={() => void stop()}
        >
          {pending ? "Menghentikan…" : "Hentikan ambil alih"}
        </Button>
      </div>
    </div>
  );
}
