"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { showError } from "@/lib/client-toast";
import type { ManagedDojoMatrixRow } from "@/lib/managed-dojos";

type MatrixPayload = {
  dojos: Array<{ id: string; name: string }>;
  rows: ManagedDojoMatrixRow[];
};

export function ManagedDojoMatrix({ branchId }: { branchId: string }) {
  const [data, setData] = useState<MatrixPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/pengaturan/managed-dojos?branchId=${encodeURIComponent(branchId)}`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(json.error || "Gagal memuat matriks");
        setData(null);
      } else {
        setData({
          dojos: json.dojos ?? [],
          rows: json.rows ?? [],
        });
      }
    } catch {
      showError("Gagal memuat matriks");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const multiRows = (data?.rows ?? []).filter((r) => r.dojoIds.length > 1);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Memuat matriks pengelola…</p>
    );
  }

  if (!data || data.dojos.length === 0) return null;

  return (
    <div className="mb-6 space-y-2 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-semibold">Pengelola multi-ranting</h3>
        <p className="text-xs text-muted-foreground">
          Akun yang membawahi lebih dari satu ranting dalam cabang ini.
        </p>
      </div>
      {multiRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada akun multi-ranting. Atur lewat tombol{" "}
          <strong>Akun</strong> → <strong>Multi</strong> /{" "}
          <strong>Tautkan akun</strong> pada ranting.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {multiRows.map((r) => (
            <li
              key={r.userId}
              className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{r.fullName || r.email}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {r.email}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Utama: {r.primaryDojoName || "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.dojoNames.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
                {!r.isActive ? (
                  <Badge variant="outline">Nonaktif</Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
