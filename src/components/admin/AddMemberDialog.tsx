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

  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultDojoId));
      setSuggestions([]);
    }
  }, [open, defaultDojoId]);

  useEffect(() => {
    if (!open) return;
    const q = form.fullName.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q });
        if (form.dojoId || defaultDojoId) {
          qs.set("dojo", form.dojoId || defaultDojoId);
        }
        const res = await fetch(`/api/admin/ukt/suggest?${qs}`);
        const data = (await res.json().catch(() => ({}))) as {
          suggestions?: MemberFormSuggestion[];
        };
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [form.fullName, form.dojoId, defaultDojoId, open]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const validationError = validateMemberFormFields(form);
    if (validationError) {
      showError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          gender: form.gender || undefined,
          birthPlace: form.birthPlace.trim() || undefined,
          birthDate: form.birthDate || undefined,
          address: form.address.trim() || undefined,
          nik: form.nik.trim() || undefined,
          nia: form.nia.trim() || undefined,
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
            cabang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <MemberIdentitySection
            idPrefix="add-member"
            form={form}
            onChange={setField}
            suggestions={suggestions}
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
          <Button className="bg-inkai-red" onClick={handleSave} disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
