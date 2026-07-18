"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import {
  reasonLabel,
  type MemberLifecycleMeta,
} from "@/lib/member-lifecycle";
import { isCabangAdmin } from "@/lib/wilayah-rbac";
import { showError, showSuccess } from "@/lib/client-toast";
import { MemberActions } from "./MemberActions";

type ArchivedRow = {
  id: string;
  fullName: string;
  nia: string | null;
  currentRank: string;
  status: string;
  updatedAt: string;
  dojo: { name: string };
  lifecycle: MemberLifecycleMeta | null;
};

export function ArchivedMembersPanel({
  userRoles = [],
  defaultDojoId = "",
}: {
  userRoles?: string[];
  defaultDojoId?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ArchivedRow[]>([]);
  const canRestore = isCabangAdmin(userRoles);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (defaultDojoId) qs.set("dojoId", defaultDojoId);
    try {
      const res = await fetch(`/api/admin/members/archived?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat arsip");
        setRows([]);
      } else {
        setRows((data.data as ArchivedRow[]) ?? []);
      }
    } catch {
      showError("Gagal memuat arsip");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, defaultDojoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Cari arsip</label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nama / NIA…"
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Muat ulang
        </Button>
      </div>

      {!canRestore ? (
        <p className="text-xs text-muted-foreground">
          Melihat arsip: pulihkan hanya oleh pengurus cabang.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>NIA</TableHead>
              <TableHead>Sabuk</TableHead>
              <TableHead className="hidden sm:table-cell">Dojo</TableHead>
              <TableHead className="hidden md:table-cell">Diarsipkan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                  Memuat arsip…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                  Tidak ada anggota di arsip.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-inkai-red">
                    {formatMemberName(m.fullName)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {m.nia || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {formatRankLabel(m.currentRank) || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {m.dojo?.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {m.lifecycle?.changedAt
                      ? new Date(m.lifecycle.changedAt).toLocaleDateString("id-ID")
                      : new Date(m.updatedAt).toLocaleDateString("id-ID")}
                    {m.lifecycle?.reasonCode
                      ? ` · ${reasonLabel(m.lifecycle.reasonCode)}`
                      : ""}
                  </TableCell>
                  <TableCell>
                    <MemberActions
                      memberId={m.id}
                      status={m.status}
                      nia={m.nia}
                      fullName={m.fullName}
                      userRoles={userRoles}
                      isArchived
                      onSuccess={() => {
                        void load();
                        router.refresh();
                        showSuccess("Daftar arsip diperbarui");
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
