"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MemberBeltSection,
  MemberIdentitySection,
  type MemberFormFields,
  validateMemberFormFields,
} from "@/components/member/MemberFormSections";
import { DEFAULT_MEMBER_RANK } from "@/lib/belt";
import { showError, showSuccess } from "@/lib/client-toast";
import type { LatberMemberRow } from "@/lib/latber";

type LatberPromoteMembershipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: LatberMemberRow | null;
  onPromoted?: () => void;
};

const emptyFromRow = (row: LatberMemberRow | null): MemberFormFields => ({
  fullName: row?.fullName ?? "",
  gender: row?.gender === "L" || row?.gender === "P" ? row.gender : "",
  birthPlace: row?.birthPlace ?? "",
  birthDate: row?.birthDate ?? "",
  address: row?.address ?? "",
  nik: row?.nik ?? "",
  nia: row?.nia ?? "",
  phoneNumber: row?.phoneNumber ?? "",
  currentRank: row?.currentRank || DEFAULT_MEMBER_RANK,
  mshNumber: "",
});

export function LatberPromoteMembershipDialog({
  open,
  onOpenChange,
  row,
  onPromoted,
}: LatberPromoteMembershipDialogProps) {
  const [form, setForm] = useState<MemberFormFields>(() => emptyFromRow(row));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setForm(emptyFromRow(row));
  }, [open, row]);

  async function handleSave() {
    if (!row) return;
    const err = validateMemberFormFields(form, {
      requireCompleteIdentity: true,
    });
    if (err) {
      showError(err);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/latber/promote-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: row.memberId,
          registrationId: row.registrationId || undefined,
          fullName: form.fullName.trim().toUpperCase(),
          gender: form.gender,
          birthPlace: form.birthPlace.trim().toUpperCase(),
          birthDate: form.birthDate,
          address: form.address.trim().toUpperCase(),
          nik: form.nik.trim() || undefined,
          phoneNumber: form.phoneNumber.trim(),
          nia: form.nia.trim() || undefined,
          currentRank: form.currentRank || DEFAULT_MEMBER_RANK,
          dojoId: row.dojoId || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showError(data.error || "Gagal menambah keanggotaan");
        return;
      }
      showSuccess("Keanggotaan diaktifkan");
      onOpenChange(false);
      onPromoted?.();
    } catch {
      showError("Gagal menambah keanggotaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah keanggotaan</DialogTitle>
          <DialogDescription>
            Lengkapi identitas peserta tamu. Status menjadi{" "}
            <strong>Active</strong>. Tidak membuat akun email/password (NIA
            auto-login jika NIA diisi).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <MemberBeltSection
            idPrefix="latber-promote"
            form={form}
            onChange={(key, value) =>
              setForm((prev) => ({ ...prev, [key]: value }))
            }
          />
          <MemberIdentitySection
            idPrefix="latber-promote"
            form={form}
            onChange={(key, value) =>
              setForm((prev) => ({ ...prev, [key]: value }))
            }
            requireCompleteIdentity
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="bg-inkai-red text-white hover:bg-inkai-red/90"
            disabled={loading || !row}
            onClick={() => void handleSave()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              "Aktifkan keanggotaan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
