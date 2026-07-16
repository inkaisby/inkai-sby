"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MemberAvatarRing } from "@/components/admin/ukt/MemberAvatarRing";
import { showError } from "@/lib/client-toast";
import type { AdminMemberRow } from "@/lib/inkai-api/admin-data";
import { MemberActions } from "./MemberActions";

type MemberDetail = Record<string, unknown>;

function formatDate(value: unknown) {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function str(value: unknown, fallback = "-") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

function DocBadge({
  label,
  url,
}: {
  label: string;
  url?: string | null;
}) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex"
      >
        <Badge
          variant="outline"
          className="gap-1 text-xs text-inkai-red hover:bg-inkai-red/5"
        >
          {label}
          <ExternalLink className="h-3 w-3" />
        </Badge>
      </a>
    );
  }

  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      {label}
    </Badge>
  );
}

function DocumentsCell({
  birthCertificateUrl,
  bpjsCardUrl,
}: {
  birthCertificateUrl?: string | null;
  bpjsCardUrl?: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <DocBadge label="Akte" url={birthCertificateUrl} />
      <DocBadge label="BPJS" url={bpjsCardUrl} />
    </div>
  );
}

function MemberStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: "Menunggu",
      className:
        "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
    },
    Active: {
      label: "Aktif",
      className:
        "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
    },
    REJECTED: {
      label: "Ditolak",
      className:
        "border-destructive/40 bg-destructive/10 text-destructive",
    },
  };
  const s = map[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

function memberPhotoUrl(member: AdminMemberRow) {
  if (member.photoUrl) return member.photoUrl;
  const nested = member as AdminMemberRow & {
    user?: { photoUrl?: string | null };
  };
  return nested.user?.photoUrl ?? null;
}

export function MembersTable({
  members,
  userRoles = [],
}: {
  members: AdminMemberRow[];
  userRoles?: string[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function openDetail(member: AdminMemberRow) {
    setSelectedId(member.id);
    setDetail(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        member?: MemberDetail;
      };
      if (!res.ok) {
        showError(data.error || "Gagal memuat detail anggota");
        setSelectedId(null);
        return;
      }
      setDetail(data.member ?? null);
    } catch {
      showError("Gagal memuat detail anggota");
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  const dojo = detail?.dojo as
    | { name?: string; branch?: { name?: string } }
    | undefined;
  const user = detail?.user as
    | { email?: string; phoneNumber?: string; photoUrl?: string }
    | undefined;
  const ranks =
    (detail?.ranks as Array<{ rank?: string; date?: string }> | undefined) ??
    [];
  const eventRegistrations =
    (detail?.eventRegistrations as
      | Array<{ status?: string; event?: { title?: string } }>
      | undefined) ?? [];

  const fullName = str(detail?.fullName, "");
  const currentRank = str(detail?.currentRank, "");
  const photoUrl =
    user?.photoUrl ??
    (typeof detail?.photoUrl === "string" ? detail.photoUrl : null);
  const birthCertificateUrl =
    typeof detail?.birthCertificateUrl === "string"
      ? detail.birthCertificateUrl
      : null;
  const bpjsCardUrl =
    typeof detail?.bpjsCardUrl === "string" ? detail.bpjsCardUrl : null;
  const bpjsCardNumber =
    typeof detail?.bpjsCardNumber === "string" ? detail.bpjsCardNumber : null;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Foto</TableHead>
              <TableHead>NIA</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Sabuk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Dokumen</TableHead>
              <TableHead className="hidden sm:table-cell">Dojo</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  Tidak ada anggota ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() => openDetail(m)}
                >
                  <TableCell>
                    <MemberAvatarRing
                      fullName={m.fullName}
                      currentRank={m.currentRank}
                      photoUrl={memberPhotoUrl(m)}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {m.nia ? (
                      m.nia
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-amber-700 border-amber-300 bg-amber-50"
                      >
                        Belum ada NIA
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-inkai-red">
                    {m.fullName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{m.currentRank}</Badge>
                  </TableCell>
                  <TableCell>
                    <MemberStatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <DocumentsCell
                      birthCertificateUrl={m.birthCertificateUrl}
                      bpjsCardUrl={m.bpjsCardUrl}
                    />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {m.dojo?.name ?? "-"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <MemberActions
                      memberId={m.id}
                      status={m.status}
                      nia={m.nia}
                      userRoles={userRoles}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetail(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto sm:max-w-md"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-3 pr-8">
              <MemberAvatarRing
                fullName={fullName || "Anggota"}
                currentRank={currentRank || null}
                photoUrl={photoUrl}
                size="lg"
              />
              <span className="leading-tight">
                {loading ? "Memuat..." : fullName || "Detail Anggota"}
              </span>
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              <span>
                NIA:{" "}
                {detail?.nia ? (
                  str(detail.nia)
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs text-amber-700 border-amber-300 bg-amber-50"
                  >
                    Belum ada NIA
                  </Badge>
                )}
              </span>
              {detail?.status ? (
                <MemberStatusBadge status={String(detail.status)} />
              ) : null}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 p-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            ) : detail ? (
              <>
                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Identitas
                  </h3>
                  <dl className="space-y-2">
                    <DetailRow
                      label="Sabuk"
                      value={
                        <Badge variant="secondary">{currentRank || "-"}</Badge>
                      }
                    />
                    <DetailRow label="NIK" value={str(detail.nik)} />
                    <DetailRow
                      label="Tempat lahir"
                      value={str(detail.birthPlace)}
                    />
                    <DetailRow
                      label="Tanggal lahir"
                      value={formatDate(detail.birthDate)}
                    />
                    <DetailRow
                      label="Jenis kelamin"
                      value={str(detail.gender)}
                    />
                    <DetailRow label="Alamat" value={str(detail.address)} />
                  </dl>
                </section>

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Organisasi
                  </h3>
                  <dl className="space-y-2">
                    <DetailRow label="Dojo" value={str(dojo?.name)} />
                    <DetailRow label="Cabang" value={str(dojo?.branch?.name)} />
                    <DetailRow label="Email" value={str(user?.email)} />
                    <DetailRow
                      label="Telepon"
                      value={str(user?.phoneNumber ?? detail.phoneNumber)}
                    />
                  </dl>
                </section>

                <section className="space-y-2.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Dokumen
                  </h3>
                  <dl className="space-y-2">
                    <DetailRow
                      label="Akte"
                      value={
                        birthCertificateUrl ? (
                          <a
                            href={birthCertificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-inkai-red hover:underline"
                          >
                            Lihat dokumen
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            Belum diunggah
                          </span>
                        )
                      }
                    />
                    <DetailRow
                      label="BPJS"
                      value={
                        bpjsCardUrl ? (
                          <a
                            href={bpjsCardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-inkai-red hover:underline"
                          >
                            Lihat dokumen
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            Belum diunggah
                          </span>
                        )
                      }
                    />
                    {bpjsCardNumber ? (
                      <DetailRow label="No. BPJS" value={bpjsCardNumber} />
                    ) : null}
                  </dl>
                </section>

                {ranks.length > 0 ? (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Riwayat sabuk
                    </h3>
                    <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm">
                      {ranks.map((r, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{str(r.rank)}</span>
                          <span className="text-muted-foreground">
                            {formatDate(r.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {eventRegistrations.length > 0 ? (
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Riwayat event
                    </h3>
                    <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm">
                      {eventRegistrations.map((er, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{str(er.event?.title)}</span>
                          <span className="text-muted-foreground">
                            {str(er.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {detail.status === "PENDING" ||
                detail.status === "REJECTED" ||
                (detail.status === "Active" && !detail.nia) ? (
                  <section className="border-t pt-4">
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {detail.status === "Active" ? "NIA" : "Aksi registrasi"}
                    </h3>
                    <MemberActions
                      memberId={String(detail.id)}
                      status={String(detail.status)}
                      nia={
                        typeof detail.nia === "string" ? detail.nia : null
                      }
                      userRoles={userRoles}
                      compact
                      onSuccess={() => {
                        const row = members.find(
                          (m) => m.id === String(detail.id),
                        );
                        if (row) void openDetail(row);
                        else if (selectedId) {
                          void openDetail({
                            id: selectedId,
                            fullName: String(detail.fullName || ""),
                            nia: null,
                            currentRank: String(detail.currentRank || ""),
                            status: String(detail.status || ""),
                            dojo: { name: "" },
                          });
                        }
                      }}
                    />
                  </section>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Detail anggota tidak tersedia.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
