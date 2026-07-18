"use client";

import { useMemo, useState } from "react";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { Input } from "@/components/ui/input";

export type AuditLogRow = {
  id: string;
  action: string;
  email: string;
  details: string;
  ip: string;
  createdAt: string;
};

export function AuditLogsClient({ logs }: { logs: AuditLogRow[] }) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean));
    return ["all", ...[...set].sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.email.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.ip.toLowerCase().includes(q)
      );
    });
  }, [logs, query, actionFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Cari</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Aksi, email, detail, IP..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Aksi</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {a === "all" ? "Semua aksi" : a}
              </option>
            ))}
          </select>
        </div>
        <ExportCsvButton
          filename={`audit-log-${new Date().toISOString().slice(0, 10)}.csv`}
          headers={["Waktu", "Aksi", "Email/User", "Detail", "IP"]}
          rows={filtered.map((l) => [
            l.createdAt,
            l.action,
            l.email,
            l.details,
            l.ip,
          ])}
          label="Export CSV"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">
          {logs.length === 0
            ? "Tidak ada log audit atau akses ditolak (hanya ADMINISTRATOR / ADMIN_PUSAT)."
            : "Tidak ada log yang cocok dengan filter."}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Menampilkan {filtered.length} dari {logs.length} log
          </p>
          {filtered.map((log) => (
            <div key={log.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{log.action}</span>
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("id-ID")}
                </span>
              </div>
              <p className="text-muted-foreground">{log.email || "—"}</p>
              {log.details ? <p>{log.details}</p> : null}
              {log.ip ? (
                <p className="text-xs text-muted-foreground">IP: {log.ip}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
