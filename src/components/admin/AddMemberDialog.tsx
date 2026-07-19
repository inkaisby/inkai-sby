"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  type MemberFormSuggestion,
  validateMemberFormFields,
} from "@/components/member/MemberFormSections";
import { DEFAULT_MEMBER_RANK } from "@/lib/belt";
import { showError, showSuccess } from "@/lib/client-toast";

export type AddMemberDojoOption = { id: string; name: string };

const emptyForm = (
  dojoId = "",
  currentRank = DEFAULT_MEMBER_RANK,
): MemberFormFields & { dojoId: string } => ({
  fullName: "",
  gender: "",
  birthPlace: "",
  birthDate: "",
  address: "",
  nik: "",
  nia: "",
  phoneNumber: "",
  currentRank,
  dojoId,
});

export function AddMemberDialog({
  open,
  onOpenChange,
  dojos = [],
  defaultDojoId = "",
  lockDojo = false,
  apiPath = "/api/admin/members",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dojos?: AddMemberDojoOption[];
  defaultDojoId?: string;
  lockDojo?: boolean;
  apiPath?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => emptyForm(defaultDojoId));
  const [suggestions, setSuggestions] = useState<MemberFormSuggestion[]>([]);
  const [duplicateBlocked, setDuplicateBlocked] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultDojoId));
      setSuggestions([]);
      setDuplicateBlocked(false);
    }
  }, [open, defaultDojoId]);

  useEffect(() => {
    if (!open) return;
    const q = form.fullName.trim();
    const nik = form.nik.trim();
    const nia = form.nia.trim();
    const birthDate = form.birthDate.trim();
    if (q.length < 3 && nik.length < 16 && nia.length < 2) {
      setSuggestions([]);
      setDuplicateBlocked(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams();
        if (q) qs.set("fullName", q);
        if (birthDate) qs.set("birthDate", birthDate);
        if (nik) qs.set("nik", nik);
        if (nia) qs.set("nia", nia);
        const res = await fetch(`/api/admin/members/check-duplicate?${qs}`);
        const data = (await res.json().catch(() => ({}))) as {
          suggestions?: MemberFormSuggestion[];
          blocked?: boolean;
        };
        setSuggestions(data.suggestions ?? []);
        setDuplicateBlocked(Boolean(data.blocked));
      } catch {
        setSuggestions([]);
        setDuplicateBlocked(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [
    form.fullName,
    form.birthDate,
    form.nik,
    form.nia,
    open,
  ]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const validationError = validateMemberFormFields(form);
    if (validationError) {
      showError(validationError);
      return;
    }
    if (duplicateBlocked) {
      showError(
        "Anggota terindikasi duplikat. Periksa data yang sudah ada atau hubungi cabang.",
      );
      return;
    }
    const resolvedDojo = form.dojoId || defaultDojoId || "";
    if (!lockDojo && dojos.length > 1 && !resolvedDojo) {
      showError("Pilih ranting tujuan anggota.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim().toUpperCase(),
          gender: form.gender || undefined,
          birthPlace: form.birthPlace.trim()
            ? form.birthPlace.trim().toUpperCase()
            : undefined,
          birthDate: form.birthDate || undefined,
          address: form.address.trim()
            ? form.address.trim().toUpperCase()
            : undefined,
          nik: form.nik.trim() || undefined,
          nia: form.nia.trim() ? form.nia.trim().toUpperCase() : undefined,
          phoneNumber: form.phoneNumber.trim() || undefined,
          currentRank: form.currentRank || DEFAULT_MEMBER_RANK,
          dojoId: form.dojoId || defaultDojoId || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showError(data.error || "Gagal menambahkan anggota");
        return;
      }
      showSuccess("Anggota berhasil ditambahkan");
      onOpenChange(false);
      router.refresh();
    } catch {
      showError("Gagal menambahkan anggota");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Anggota Baru</DialogTitle>
          <DialogDescription>
            Ranting dapat menambahkan anggota baru. Status aktif langsung. NIA
            opsional jika sudah diketahui; bila kosong dapat diisi pengurus
            cabang. Jika anggota sudah daftar mandiri, gunakan{" "}
            <strong>Gabungkan</strong> di detail Kelola Anggota.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <MemberIdentitySection
            idPrefix="add-member"
            form={form}
            onChange={setField}
            suggestions={suggestions}
            duplicateBlocked={duplicateBlocked}
          />

          <MemberBeltSection idPrefix="add-member" form={form} onChange={setField} />

          {!lockDojo && dojos.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="add-member-dojo">Dojo / Ranting</Label>
              <select
                id="add-member-dojo"
                className="h-9 w-full rounded-lg border px-2 text-sm"
                value={form.dojoId}
                onChange={(e) => setField("dojoId", e.target.value)}
              >
                <option value="">Pilih dojo</option>
                {dojos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button
            className="bg-inkai-red"
            onClick={handleSave}
            disabled={loading || duplicateBlocked}
          >
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
