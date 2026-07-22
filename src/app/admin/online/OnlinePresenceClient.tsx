"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatRelativeId,
  type PresenceListRow,
} from "@/lib/presence-constants";
import { RefreshCw } from "lucide-react";

type PresenceResponse = {
  generatedAt: string;
  onlineThresholdMs: number;
  kpi: { online: number; login24h: number; totalAccounts: number };
  rows: PresenceListRow[];
};

type StatusFilter = "online" | "login24h" | "all";

export function OnlinePresenceClient() {
  const [status, setStatus] = useState<StatusFilter>("online");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PresenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/presence?${params}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Gagal memuat kehadiran akun");
        setData(null);
        return;
      }
      setData(json as PresenceResponse);
    } catch {
      setError("Gagal memuat kehadiran akun");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      void load({ silent: true });
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const groups = useMemo(() => {
    const rows = data?.rows ?? [];
    const map = new Map<string, PresenceListRow[]>();
    for (const row of rows) {
      const key = row.scopeLabel || "—";
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "id"));
  }, [data?.rows]);

  const thresholdMin = Math.round((data?.onlineThresholdMs ?? 300_000) / 60_000);
  const updatedLabel = data?.generatedAt
    ? formatRelativeId(data.generatedAt)
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Kehadiran operasional</p>
        <p className="mt-1">
          <span className="text-emerald-700 dark:text-emerald-400">Sedang aktif</span>{" "}
          = membuka aplikasi dalam ±{thresholdMin} menit terakhir.{" "}
          <span className="text-foreground/80">Tidak aktif</span> bukan berarti
          akun tidak ada — hanya sedang tidak memakai portal. Status bisa
          tertunda ±1–2 menit setelah tab ditutup.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Sedang aktif" value={data?.kpi.online ?? "—"} accent />
        <KpiCard label="Login 24 jam" value={data?.kpi.login24h ?? "—"} />
        <KpiCard label="Akun di cakupan" value={data?.kpi.totalAccounts ?? "—"} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Cari</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nama, email, peran, ranting..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tampil</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="online">Sedang aktif</option>
            <option value="login24h">Login 24 jam</option>
            <option value="all">Aktif + login 24 jam</option>
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          disabled={loading || pending}
          onClick={() => void load()}
        >
          <RefreshCw className={`size-3.5 ${loading || pending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <ExportCsvButton
          filename={`kehadiran-akun-${new Date().toISOString().slice(0, 10)}.csv`}
          headers={[
            "Nama",
            "Email",
            "Peran",
            "Wilayah",
            "Status",
            "Terakhir terlihat",
            "Terakhir login",
          ]}
          rows={(data?.rows ?? []).map((r) => [
            r.fullName || "",
            r.email,
            r.roleLabel,
            r.scopeLabel,
            r.online ? "Sedang aktif" : "Tidak aktif",
            r.lastSeenAt || "",
            r.lastLoginAt || "",
          ])}
          label="Export CSV"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          {updatedLabel
            ? `Diperbarui ${updatedLabel}`
            : loading
              ? "Memuat..."
              : "—"}
        </p>
        <p>
          {data
            ? `Menampilkan ${data.rows.length} akun`
            : null}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {!error && !loading && (data?.rows.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          {status === "online"
            ? "Belum ada akun aktif dalam beberapa menit terakhir."
            : "Tidak ada akun yang cocok dengan filter."}
        </p>
      ) : null}

      <div className="space-y-6">
        {groups.map(([scope, rows]) => (
          <section key={scope} className="space-y-2">
            <h3 className="text-sm font-semibold tracking-tight">
              {scope}{" "}
              <span className="font-normal text-muted-foreground">
                ({rows.length})
              </span>
            </h3>
            <div className="space-y-2">
              {rows.map((row) => (
                <PresenceRow key={row.id} row={row} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent ? "text-emerald-700 dark:text-emerald-400" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PresenceRow({ row }: { row: PresenceListRow }) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium truncate">
              {row.fullName || row.email}
            </p>
            {row.isSelf ? (
              <Badge variant="outline" className="text-[10px]">
                Anda
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-[10px]">
              {row.roleLabel}
            </Badge>
          </div>
          <p className="text-muted-foreground truncate">{row.email}</p>
        </div>
        <StatusBadge online={row.online} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Terlihat: {formatRelativeId(row.lastSeenAt)}</span>
        <span>Login: {formatRelativeId(row.lastLoginAt)}</span>
      </div>
    </div>
  );
}

function StatusBadge({ online }: { online: boolean }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Sedang aktif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
      Tidak aktif
    </span>
  );
}
