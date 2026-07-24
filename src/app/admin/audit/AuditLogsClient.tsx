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

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/** Aksi keamanan: prefix SECURITY_, impersonasi, atau upload/broadcast (rawan disalahgunakan). */
export function isSecurityAuditAction(action: string): boolean {
  const a = action.toUpperCase();
  return (
    a.startsWith("SECURITY_") ||
    a.includes("IMPERSONATE") ||
    a.includes("UPLOAD") ||
    a.includes("BROADCAST")
  );
}

type QuickFilter = "all" | "security";

export function AuditLogsClient({ logs }: { logs: AuditLogRow[] }) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean));
    return ["all", ...[...set].sort()];
  }, [logs]);

  const securityCount = useMemo(
    () => logs.filter((l) => isSecurityAuditAction(l.action)).length,
    [logs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (quickFilter === "security" && !isSecurityAuditAction(log.action)) {
        return false;
      }
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.email.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.ip.toLowerCase().includes(q)
      );
    });
  }, [logs, query, actionFilter, quickFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setQuickFilter("all");
            setPage(1);
          }}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            quickFilter === "all"
              ? "border-inkai-red bg-inkai-red text-white"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Semua ({logs.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setQuickFilter("security");
            setPage(1);
          }}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            quickFilter === "security"
              ? "border-inkai-red bg-inkai-red text-white"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Keamanan ({securityCount})
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Cari</label>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Aksi, email, detail, IP..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Aksi</label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {a === "all" ? "Semua aksi" : a}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Per halaman
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
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
            Menampilkan {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}{" "}
            dari {filtered.length} log{filtered.length !== logs.length ? ` (total ${logs.length})` : ""}
          </p>
          {paged.map((log) => (
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

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Halaman {safePage} dari {totalPages}
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border px-2.5 py-1 text-sm hover:bg-muted disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border px-2.5 py-1 text-sm hover:bg-muted disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
