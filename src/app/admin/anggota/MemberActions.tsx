"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, UserMinus, UserCheck, Trash2, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canAssignNia } from "@/lib/belt";
import {
  DEACTIVATE_REASON_CODES,
  DEACTIVATE_REASON_LABELS,
  type DeactivateReasonCode,
  type MemberImpactSummary,
  type MemberStatusKind,
} from "@/lib/member-lifecycle";
import {
  canSoftDeleteMembers,
  canToggleMemberActive,
  isCabangAdmin,
} from "@/lib/wilayah-rbac";
import { showError, showSuccess } from "@/lib/client-toast";

type ConfirmKind = "deactivate" | "activate" | "delete" | "restore" | null;

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function MemberActions({
  memberId,
  status,
  nia,
  fullName = "",
  userRoles = [],
  compact = false,
  isArchived = false,
  impact,
  onSuccess,
}: {
  memberId: string;
  status: string;
  nia?: string | null;
  fullName?: string;
  userRoles?: string[];
  compact?: boolean;
  isArchived?: boolean;
  impact?: MemberImpactSummary | null;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [niaInput, setNiaInput] = useState(nia || "");
  const [loading, setLoading] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [confirmName, setConfirmName] = useState("");
  const [statusKind, setStatusKind] = useState<MemberStatusKind>("INACTIVE");
  const [reasonCode, setReasonCode] =
    useState<DeactivateReasonCode>("BERHENTI_LATIHAN");
  const [reasonNote, setReasonNote] = useState("");
  const [fetchedImpact, setFetchedImpact] = useState<MemberImpactSummary | null>(
    impact ?? null,
  );

  const assignNia = canAssignNia(userRoles);
  const canToggle = canToggleMemberActive(userRoles);
  const canDelete = canSoftDeleteMembers(userRoles);
  const isCabang = isCabangAdmin(userRoles);
  const needsNia = !nia?.trim();
  const statusKey = normalizeStatus(status);
  const isActive = statusKey === "ACTIVE";
  const isInactiveLike = statusKey === "INACTIVE" || statusKey === "SUSPENDED";
  const isPending = statusKey === "PENDING";
  const isRejected = statusKey === "REJECTED";
  const hasOfficialNia = Boolean(nia?.trim());
  const deleteNeedsNameConfirm = isActive || hasOfficialNia;
  /** Ranting: hanya koreksi (bukan aktif/ber-NIA). Cabang: semua. */
  const canDeleteThis =
    canDelete && !isArchived && (isCabang || (!isActive && !hasOfficialNia));
  const canRestore = isArchived && isCabang;

  useEffect(() => {
    setNiaInput(nia || "");
  }, [nia, memberId]);

  useEffect(() => {
    if (!confirmKind) {
      setConfirmName("");
      setReasonNote("");
      setStatusKind("INACTIVE");
      setReasonCode("BERHENTI_LATIHAN");
    }
  }, [confirmKind]);

  useEffect(() => {
    if (confirmKind === "delete" && !impact && !fetchedImpact) {
      void fetch(`/api/admin/members/${memberId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.member?.impact) setFetchedImpact(data.member.impact);
        })
        .catch(() => {});
    }
  }, [confirmKind, impact, fetchedImpact, memberId]);

  async function handleAction(
    action:
      | "approve"
      | "reject"
      | "set_nia"
      | "deactivate"
      | "activate"
      | "delete"
      | "restore",
    extra?: Record<string, unknown>,
  ) {
    if (action === "set_nia" && !niaInput.trim()) {
      showError("NIA wajib diisi");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(niaInput.trim() ? { nia: niaInput.trim() } : {}),
        ...extra,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Aksi berhasil disimpan");
      setConfirmKind(null);
      onSuccess?.();
      router.refresh();
    } else {
      showError(data.error || "Gagal memproses aksi");
    }
  }

  function submitConfirm() {
    if (!confirmKind) return;
    if (confirmKind === "deactivate") {
      void handleAction("deactivate", {
        statusKind,
        reasonCode,
        reasonNote: reasonNote.trim() || undefined,
      });
      return;
    }
    if (confirmKind === "delete" && deleteNeedsNameConfirm) {
      if (confirmName.trim().toUpperCase() !== fullName.trim().toUpperCase()) {
        showError("Nama konfirmasi belum cocok");
        return;
      }
      void handleAction("delete", { confirmName: confirmName.trim() });
      return;
    }
    void handleAction(confirmKind);
  }

  const impactData = impact ?? fetchedImpact;
  const hasImpact =
    impactData &&
    (impactData.unpaidBillingCount > 0 ||
      impactData.openEventRegistrationCount > 0);

  const lifecycleMenu =
    canToggle || canDeleteThis || canRestore ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 px-0"
            disabled={loading}
            aria-label="Kelola status anggota"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canToggle && isActive ? (
            <DropdownMenuItem
              onClick={() => setConfirmKind("deactivate")}
              className="gap-2"
            >
              <UserMinus className="h-4 w-4" />
              Nonaktifkan…
            </DropdownMenuItem>
          ) : null}
          {canToggle && isInactiveLike && !isArchived ? (
            <DropdownMenuItem
              onClick={() => setConfirmKind("activate")}
              className="gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Aktifkan kembali
            </DropdownMenuItem>
          ) : null}
          {canRestore ? (
            <DropdownMenuItem
              onClick={() => setConfirmKind("restore")}
              className="gap-2"
            >
              <ArchiveRestore className="h-4 w-4" />
              Pulihkan dari arsip
            </DropdownMenuItem>
          ) : null}
          {canDeleteThis ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmKind("delete")}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Hapus / arsipkan
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const confirmDialog = (
    <Dialog
      open={!!confirmKind}
      onOpenChange={(open) => {
        if (!open) setConfirmKind(null);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>
            {confirmKind === "deactivate"
              ? "Nonaktifkan anggota?"
              : confirmKind === "activate"
                ? "Aktifkan kembali?"
                : confirmKind === "restore"
                  ? "Pulihkan dari arsip?"
                  : "Hapus / arsipkan anggota?"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {confirmKind === "deactivate" ? (
                <>
                  <p>
                    <span className="font-medium text-foreground">
                      {fullName || "Anggota ini"}
                    </span>{" "}
                    tidak bisa login. NIA & riwayat tetap tersimpan.
                  </p>
                  <p>Pilih jenis dan alasan agar pengurus berikutnya paham konteks.</p>
                </>
              ) : null}
              {confirmKind === "activate" ? (
                <p>
                  Mengembalikan status aktif untuk{" "}
                  <span className="font-medium text-foreground">
                    {fullName || "anggota ini"}
                  </span>
                  .
                </p>
              ) : null}
              {confirmKind === "restore" ? (
                <p>
                  Anggota dipulihkan sebagai <strong>Nonaktif</strong>. Aktifkan
                  kembali setelah dicek.
                </p>
              ) : null}
              {confirmKind === "delete" ? (
                <>
                  <p>
                    Soft-delete: hilang dari daftar operasional, jejak audit
                    tetap ada.
                  </p>
                  {hasImpact ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <p className="font-medium">Dampak terdeteksi:</p>
                      <ul className="mt-1 list-inside list-disc text-xs">
                        {impactData!.unpaidBillingCount > 0 ? (
                          <li>
                            {impactData!.unpaidBillingCount} tagihan belum lunas
                            ({formatRp(impactData!.unpaidBillingAmount)})
                          </li>
                        ) : null}
                        {impactData!.uktOpenCount > 0 ? (
                          <li>{impactData!.uktOpenCount} pendaftaran UKT terbuka</li>
                        ) : null}
                        {impactData!.openEventRegistrationCount >
                        impactData!.uktOpenCount ? (
                          <li>
                            {impactData!.openEventRegistrationCount} pendaftaran
                            event terbuka
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                  {deleteNeedsNameConfirm ? (
                    <p className="text-amber-700 dark:text-amber-400">
                      Ketik nama lengkap untuk konfirmasi. Pertimbangkan
                      Nonaktifkan jika masih mungkin kembali.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        {confirmKind === "deactivate" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Jenis</label>
              <select
                value={statusKind}
                onChange={(e) =>
                  setStatusKind(e.target.value as MemberStatusKind)
                }
                className="h-9 w-full rounded-lg border px-2 text-sm"
                disabled={loading}
              >
                <option value="INACTIVE">Nonaktif (berhenti / pindah)</option>
                <option value="SUSPENDED">Ditangguhkan (disiplin)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Alasan</label>
              <select
                value={reasonCode}
                onChange={(e) =>
                  setReasonCode(e.target.value as DeactivateReasonCode)
                }
                className="h-9 w-full rounded-lg border px-2 text-sm"
                disabled={loading}
              >
                {DEACTIVATE_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {DEACTIVATE_REASON_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Catatan (opsional)
              </label>
              <Input
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Contoh: pindah ke Malang, Juli 2026"
                disabled={loading}
              />
            </div>
          </div>
        ) : null}

        {confirmKind === "delete" && deleteNeedsNameConfirm ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Ketik nama:{" "}
              <span className="font-medium text-foreground">{fullName}</span>
            </label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Nama lengkap anggota"
              autoComplete="off"
              disabled={loading}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setConfirmKind(null)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant={
              confirmKind === "activate" || confirmKind === "restore"
                ? "default"
                : "destructive"
            }
            className={
              confirmKind === "activate" || confirmKind === "restore"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : ""
            }
            disabled={loading}
            onClick={submitConfirm}
          >
            {loading
              ? "Memproses…"
              : confirmKind === "deactivate"
                ? statusKind === "SUSPENDED"
                  ? "Tangguhkan"
                  : "Nonaktifkan"
                : confirmKind === "activate"
                  ? "Aktifkan"
                  : confirmKind === "restore"
                    ? "Pulihkan"
                    : "Arsipkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isArchived) {
    return (
      <>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Arsip</span>
          {lifecycleMenu}
        </div>
        {confirmDialog}
      </>
    );
  }

  if (isActive) {
    return (
      <>
        <div
          className={
            compact
              ? "flex flex-col gap-2"
              : "flex flex-col gap-2 sm:flex-row sm:items-center"
          }
        >
          {assignNia && needsNia ? (
            <>
              <Input
                placeholder="Isi NIA"
                value={niaInput}
                onChange={(e) => setNiaInput(e.target.value)}
                className="h-8 w-28"
              />
              <Button
                size="sm"
                className="h-8 bg-inkai-red"
                disabled={loading}
                onClick={() => handleAction("set_nia")}
              >
                Simpan NIA
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {nia?.trim() ? "Aktif" : "Aktif · tanpa NIA"}
            </span>
          )}
          <div className="flex items-center gap-1">
            {canToggle ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={loading}
                onClick={() => setConfirmKind("deactivate")}
              >
                Nonaktifkan
              </Button>
            ) : null}
            {lifecycleMenu}
          </div>
        </div>
        {confirmDialog}
      </>
    );
  }

  if (isInactiveLike) {
    return (
      <>
        <div className="flex items-center gap-1">
          {canToggle ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              disabled={loading}
              onClick={() => setConfirmKind("activate")}
            >
              Aktifkan
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {statusKey === "SUSPENDED" ? "Ditangguhkan" : "Nonaktif"}
            </span>
          )}
          {lifecycleMenu}
        </div>
        {confirmDialog}
      </>
    );
  }

  if (isRejected) {
    return (
      <>
        <div className="flex items-center gap-1">
          <span className="text-xs text-destructive">Ditolak</span>
          {lifecycleMenu}
        </div>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {assignNia ? (
          <Input
            placeholder="NIA (opsional)"
            value={niaInput}
            onChange={(e) => setNiaInput(e.target.value)}
            className="h-8 w-28"
          />
        ) : null}
        <div className="flex gap-1">
          <Button
            size="sm"
            className="h-8 bg-green-600 hover:bg-green-700"
            disabled={loading}
            onClick={() => handleAction("approve")}
          >
            Setujui
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
            disabled={loading}
            onClick={() => handleAction("reject")}
          >
            Tolak
          </Button>
          {lifecycleMenu}
        </div>
      </div>
      {confirmDialog}
    </>
  );
}
