import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchPendingVerificationClaims } from "@/lib/inkai-api/admin-data";
import {
  fetchVerificationHistory,
  parseResetEmail,
  VERIFICATION_HISTORY_TYPES,
  VERIFICATION_TYPE_LABELS,
} from "@/lib/verification-history";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VerificationActions } from "./VerificationActions";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { OptimisticHide } from "@/components/admin/OptimisticHide";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  type?: string;
  pendingType?: string;
  page?: string;
}>;

function buildHistoryHref(opts: {
  q: string;
  status: string;
  type: string;
  page: number;
}) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.status) params.set("status", opts.status);
  if (opts.type) params.set("type", opts.type);
  if (opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

export default function AdminVerifikasiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminVerifikasiContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminVerifikasiContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "";
  const type = params.type?.trim() || "";
  const pendingType = params.pendingType?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const [claimsRaw, history] = await Promise.all([
    fetchPendingVerificationClaims(token),
    fetchVerificationHistory(session.user, {
      q,
      status,
      type,
      page,
      limit: 20,
    }),
  ]);

  const claims = pendingType
    ? claimsRaw.filter((c) => String(c.type) === pendingType)
    : claimsRaw;

  const agingDays = (createdAt: unknown) => {
    const t = new Date(String(createdAt || "")).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  };

  const pendingTypes = Array.from(
    new Set(claimsRaw.map((c) => String(c.type))),
  ).sort();

  const pageWindow = 5;
  const startPage = Math.max(1, history.page - Math.floor(pageWindow / 2));
  const endPage = Math.min(history.totalPages, startPage + pageWindow - 1);
  const pages = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i,
  );

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Antrian Verifikasi</h2>
        <p className="text-muted-foreground">
          {claims.length} pengajuan menunggu
          {pendingType
            ? ` (filter ${VERIFICATION_TYPE_LABELS[pendingType] || pendingType})`
            : ""}{" "}
          dari {claimsRaw.length} total
        </p>
        {pendingTypes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/verifikasi"
              className={`rounded-lg px-3 py-1 text-xs ${
                !pendingType ? "bg-inkai-red text-white" : "border"
              }`}
            >
              Semua
            </Link>
            {pendingTypes.map((t) => (
              <Link
                key={t}
                href={`/admin/verifikasi?pendingType=${encodeURIComponent(t)}`}
                className={`rounded-lg px-3 py-1 text-xs ${
                  pendingType === t ? "bg-inkai-red text-white" : "border"
                }`}
              >
                {VERIFICATION_TYPE_LABELS[t] || t}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {claims.length === 0 ? (
        <Card className="mb-10">
          <CardContent className="p-8 text-center text-muted-foreground">
            Tidak ada pengajuan verifikasi pending.
          </CardContent>
        </Card>
      ) : (
        <div className="mb-10 space-y-3">
          {claims.map((c) => {
            const member = c.member as Record<string, unknown> | undefined;
            const dojo = member?.dojo as { name?: string } | undefined;
            const event = c.event as { title?: string } | undefined;
            const claimType = String(c.type);
            const age = agingDays(c.createdAt);
            const resetEmail =
              claimType === "PASSWORD_RESET"
                ? parseResetEmail(
                    c.data != null ? String(c.data) : undefined,
                  )
                : null;
            return (
              <OptimisticHide key={String(c.id)}>
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {String(member?.fullName ?? "—")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {String(member?.nia ?? "—")} · {dojo?.name ?? "—"}
                          {age != null ? ` · ${age} hari di antrian` : ""}
                        </p>
                        {resetEmail ? (
                          <p className="text-sm font-medium text-inkai-red">
                            Email login: {resetEmail}
                          </p>
                        ) : null}
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          claimType === "PASSWORD_RESET"
                            ? "bg-inkai-red/10 text-inkai-red"
                            : undefined
                        }
                      >
                        {VERIFICATION_TYPE_LABELS[claimType] || claimType}
                      </Badge>
                    </div>
                    {claimType !== "PASSWORD_RESET" &&
                      c.data != null &&
                      c.data !== "" && (
                        <p className="mb-2 text-sm whitespace-pre-wrap">
                          {(() => {
                            try {
                              const parsed = JSON.parse(String(c.data)) as Record<
                                string,
                                unknown
                              >;
                              if (claimType === "DOJO_TRANSFER" || claimType === "TRANSFER") {
                                return `${parsed.fromDojoName ?? "—"} → ${parsed.targetDojoName ?? "—"}\n${parsed.reason ?? ""}`;
                              }
                              if (claimType === "ACHIEVEMENT") {
                                return `${parsed.title ?? "Piagam"}${parsed.notes ? `\n${parsed.notes}` : ""}`;
                              }
                              return JSON.stringify(parsed, null, 2);
                            } catch {
                              return String(c.data);
                            }
                          })()}
                        </p>
                      )}
                    {event != null && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        Event: {event.title}
                      </p>
                    )}
                    {c.proofUrl != null &&
                      c.proofUrl !== "" &&
                      c.proofUrl !== "—" && (
                        <a
                          href={String(c.proofUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-3 inline-block text-xs text-inkai-red hover:underline"
                        >
                          Lihat bukti pendukung
                        </a>
                      )}
                    <p className="mb-3 text-xs text-muted-foreground">
                      Diajukan:{" "}
                      {new Date(String(c.createdAt)).toLocaleString("id-ID")}
                    </p>
                    <VerificationActions
                      verificationId={String(c.id)}
                      type={claimType}
                      nameHint={String(member?.fullName ?? "")}
                    />
                  </CardContent>
                </Card>
              </OptimisticHide>
            );
          })}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Riwayat Verifikasi</h3>
          <p className="text-sm text-muted-foreground">
            {history.total} data diproses
            {history.total > 0
              ? ` · halaman ${history.page} dari ${history.totalPages}`
              : ""}
          </p>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Cari nama / NIA..."
          defaultValue={q}
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">Semua status</option>
          <option value="APPROVED">Disetujui</option>
          <option value="REJECTED">Ditolak</option>
        </select>
        <select
          name="type"
          defaultValue={type}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">Semua jenis</option>
          {VERIFICATION_HISTORY_TYPES.map((t) => (
            <option key={t} value={t}>
              {VERIFICATION_TYPE_LABELS[t] || t}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-inkai-red px-4 py-1.5 text-sm text-white hover:bg-inkai-red/90"
        >
          Filter
        </button>
        {(q || status || type) && (
          <Link
            href="/admin/verifikasi"
            className="rounded-lg border px-4 py-1.5 text-sm hover:bg-muted"
          >
            Reset
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Anggota</TableHead>
              <TableHead className="hidden sm:table-cell">Dojo</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Tidak ada riwayat untuk filter ini.
                </TableCell>
              </TableRow>
            ) : (
              history.rows.map((row) => {
                const resetEmail =
                  row.type === "PASSWORD_RESET"
                    ? parseResetEmail(row.data)
                    : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(row.updatedAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{row.member?.fullName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.member?.nia ?? "—"}
                        {resetEmail ? ` · ${resetEmail}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {row.member?.dojo?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          row.type === "PASSWORD_RESET"
                            ? "bg-inkai-red/10 text-inkai-red"
                            : undefined
                        }
                      >
                        {VERIFICATION_TYPE_LABELS[row.type] || row.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          row.status === "APPROVED"
                            ? "bg-emerald-600 hover:bg-emerald-600"
                            : "bg-destructive hover:bg-destructive"
                        }
                      >
                        {row.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] truncate text-sm text-muted-foreground md:table-cell">
                      {row.adminNotes || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {history.totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={buildHistoryHref({
              q,
              status,
              type,
              page: Math.max(1, history.page - 1),
            })}
            className={`rounded border px-2 py-1 ${
              history.page <= 1 ? "pointer-events-none opacity-40" : ""
            }`}
            aria-disabled={history.page <= 1}
          >
            Prev
          </Link>
          {startPage > 1 && (
            <>
              <Link
                href={buildHistoryHref({ q, status, type, page: 1 })}
                className="rounded border px-2 py-1"
              >
                1
              </Link>
              {startPage > 2 && (
                <span className="px-1 text-muted-foreground">…</span>
              )}
            </>
          )}
          {pages.map((p) => (
            <Link
              key={p}
              href={buildHistoryHref({ q, status, type, page: p })}
              className={`rounded px-2 py-1 ${
                p === history.page
                  ? "bg-inkai-red text-white"
                  : "border hover:bg-muted"
              }`}
            >
              {p}
            </Link>
          ))}
          {endPage < history.totalPages && (
            <>
              {endPage < history.totalPages - 1 && (
                <span className="px-1 text-muted-foreground">…</span>
              )}
              <Link
                href={buildHistoryHref({
                  q,
                  status,
                  type,
                  page: history.totalPages,
                })}
                className="rounded border px-2 py-1"
              >
                {history.totalPages}
              </Link>
            </>
          )}
          <Link
            href={buildHistoryHref({
              q,
              status,
              type,
              page: Math.min(history.totalPages, history.page + 1),
            })}
            className={`rounded border px-2 py-1 ${
              history.page >= history.totalPages
                ? "pointer-events-none opacity-40"
                : ""
            }`}
            aria-disabled={history.page >= history.totalPages}
          >
            Next
          </Link>
        </div>
      )}
    </>
  );
}
