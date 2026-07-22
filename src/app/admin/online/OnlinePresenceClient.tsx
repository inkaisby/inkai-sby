"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatRelativeId,
  type PresenceListRow,
} from "@/lib/presence-constants";
import {
  ChevronDown,
  ChevronRight,
  Globe2,
  MonitorSmartphone,
  Network,
  RefreshCw,
} from "lucide-react";

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
      if (document.visibilityState === "hidden") return;
      void load({ silent: true });
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
    <div className="space-y-4 sm:space-y-5">
      <details className="rounded-xl border border-border/70 bg-muted/30 open:pb-0">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium marker:content-none sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Kehadiran & jejak audit
            <span className="text-xs font-normal text-muted-foreground sm:hidden">
              Info
            </span>
          </span>
        </summary>
        <p className="border-t px-3 pb-3 pt-2 text-sm text-muted-foreground sm:px-4">
          <span className="text-emerald-700 dark:text-emerald-400">Sedang aktif</span>{" "}
          = membuka aplikasi dalam ±{thresholdMin} menit. Setiap baris menampilkan
          IP, perangkat, dan perkiraan lokasi (dari edge CDN bila tersedia).
          Lokasi kota hanya akurat di production (Vercel/Cloudflare).
        </p>
      </details>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0">
        <div className="w-[9rem] shrink-0 sm:w-auto sm:min-w-0">
          <KpiCard label="Sedang aktif" value={data?.kpi.online ?? "—"} accent />
        </div>
        <div className="w-[9rem] shrink-0 sm:w-auto sm:min-w-0">
          <KpiCard label="Login 24 jam" value={data?.kpi.login24h ?? "—"} />
        </div>
        <div className="w-[9rem] shrink-0 sm:w-auto sm:min-w-0">
          <KpiCard label="Akun di cakupan" value={data?.kpi.totalAccounts ?? "—"} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <div className="min-w-0 w-full space-y-1 sm:min-w-[200px] sm:flex-1 sm:max-w-md">
          <label className="text-xs font-medium text-muted-foreground">Cari</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nama, email, IP, perangkat, lokasi..."
            className="h-10 sm:h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tampil</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="h-10 w-full rounded-lg border bg-background px-2 text-sm sm:h-9 sm:w-auto"
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
            className="h-10 gap-1.5 sm:h-9"
            disabled={loading || pending}
            onClick={() => void load()}
          >
            <RefreshCw className={`size-3.5 ${loading || pending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <div className="col-span-2 sm:col-span-1">
            <ExportCsvButton
              filename={`kehadiran-akun-${new Date().toISOString().slice(0, 10)}.csv`}
              headers={[
                "Nama",
                "Email",
                "Peran",
                "Wilayah",
                "Status",
                "Terakhir terlihat",
                "Login",
                "IP",
                "Perangkat",
                "Browser",
                "OS",
                "Lokasi",
                "Zona waktu",
                "Bahasa",
                "Layar",
                "User-Agent",
              ]}
              rows={(data?.rows ?? []).map((r) => [
                r.fullName || "",
                r.email,
                r.roleLabel,
                r.scopeLabel,
                r.online ? "Sedang aktif" : "Tidak aktif",
                r.lastSeenAt || "",
                r.lastLoginAt || r.session?.startedAt || "",
                r.session?.ip || "",
                r.session?.deviceType || "",
                r.session?.browser || "",
                r.session?.os || "",
                r.session?.locationLabel || "",
                r.session?.timezone || "",
                r.session?.language || "",
                r.session?.screen || "",
                r.session?.userAgent || "",
              ])}
              label="Export CSV"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          {updatedLabel
            ? `Diperbarui ${updatedLabel}`
            : loading
              ? "Memuat..."
              : "—"}
        </p>
        <p>{data ? `Menampilkan ${data.rows.length} akun` : null}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
  const [open, setOpen] = useState(false);
  const sess = row.session;
  const loginAt = row.lastLoginAt || sess?.startedAt || null;

  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium truncate">{row.fullName || row.email}</p>
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

      <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
        <MetaLine
          icon={<Network className="size-3.5 shrink-0" />}
          label="IP"
          value={sess?.ip || "—"}
        />
        <MetaLine
          icon={<MonitorSmartphone className="size-3.5 shrink-0" />}
          label="Perangkat"
          value={sess?.deviceLabel || "—"}
        />
        <MetaLine
          icon={<Globe2 className="size-3.5 shrink-0" />}
          label="Lokasi"
          value={sess?.locationLabel || sess?.timezone || "—"}
        />
        <p>
          Terlihat {formatRelativeId(row.lastSeenAt)} · Login{" "}
          {formatRelativeId(loginAt)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground/80 hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        Detail audit
      </button>

      {open ? (
        <div className="mt-2 space-y-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          <DetailRow
            label="Waktu login"
            value={
              loginAt
                ? new Date(loginAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  })
                : "—"
            }
          />
          <DetailRow
            label="Terakhir terlihat"
            value={
              row.lastSeenAt
                ? new Date(row.lastSeenAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  })
                : "—"
            }
          />
          <DetailRow label="IP" value={sess?.ip || "—"} />
          <DetailRow label="Tipe perangkat" value={sess?.deviceType || "—"} />
          <DetailRow label="Browser" value={sess?.browser || "—"} />
          <DetailRow label="Sistem operasi" value={sess?.os || "—"} />
          <DetailRow label="Platform" value={sess?.platform || "—"} />
          <DetailRow label="Resolusi layar" value={sess?.screen || "—"} />
          <DetailRow label="Kota" value={sess?.city || "—"} />
          <DetailRow label="Wilayah/provinsi CDN" value={sess?.region || "—"} />
          <DetailRow label="Negara" value={sess?.country || "—"} />
          <DetailRow label="Zona waktu" value={sess?.timezone || "—"} />
          <DetailRow label="Bahasa browser" value={sess?.language || "—"} />
          <DetailRow
            label="User-Agent"
            value={sess?.userAgent || "—"}
            mono
          />
        </div>
      ) : null}
    </div>
  );
}

function MetaLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <p className="flex min-w-0 items-start gap-1.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="text-muted-foreground/80">{label}: </span>
        <span className="break-all text-foreground/90">{value}</span>
      </span>
    </p>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[140px_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`break-all text-foreground/90 ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
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
