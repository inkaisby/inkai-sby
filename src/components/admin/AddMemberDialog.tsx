"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BELT_RANK_OPTIONS, DEFAULT_MEMBER_RANK } from "@/lib/belt";
import { showError, showSuccess } from "@/lib/client-toast";

export type AddMemberDojoOption = { id: string; name: string };

type Suggestion = {
  id: string;
  fullName: string;
  nia?: string | null;
  dojoName?: string;
  currentRank?: string;
};

type FormState = {
  fullName: string;
  gender: string;
  birthPlace: string;
  birthDate: string;
  address: string;
  nik: string;
  phoneNumber: string;
  currentRank: string;
  dojoId: string;
};

const emptyForm = (dojoId = "", currentRank = DEFAULT_MEMBER_RANK): FormState => ({
  fullName: "",
  gender: "",
  birthPlace: "",
  birthDate: "",
  address: "",
  nik: "",
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
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultDojoId));
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

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
          suggestions?: Suggestion[];
        };
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [form.fullName, form.dojoId, defaultDojoId, open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      showError("Nama lengkap wajib diisi");
      return;
    }
    if (form.nik && !/^\d{16}$/.test(form.nik.trim())) {
      showError("NIK harus 16 digit");
      return;
    }
    if (form.phoneNumber && form.phoneNumber.trim().length < 10) {
      showError("Nomor telepon tidak valid");
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
            Ranting dapat menambahkan anggota baru. Status aktif langsung; NIA
            diisi oleh pengurus cabang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Identitas
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="add-member-name">Nama Lengkap *</Label>
              <Input
                id="add-member-name"
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                placeholder="Nama sesuai identitas"
              />
              {suggestions.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="mb-1 font-medium">
                    Kemungkinan sudah terdaftar — periksa sebelum simpan:
                  </p>
                  <ul className="space-y-0.5">
                    {suggestions.slice(0, 5).map((s) => (
                      <li key={s.id}>
                        {s.fullName}
                        {s.nia ? ` · ${s.nia}` : " · tanpa NIA"}
                        {s.dojoName ? ` · ${s.dojoName}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-member-gender">Jenis Kelamin</Label>
              <select
                id="add-member-gender"
                className="h-9 w-full rounded-lg border px-2 text-sm"
                value={form.gender}
                onChange={(e) => setField("gender", e.target.value)}
              >
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-member-birth-place">Tempat Lahir</Label>
                <Input
                  id="add-member-birth-place"
                  value={form.birthPlace}
                  onChange={(e) => setField("birthPlace", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-member-birth-date">Tanggal Lahir</Label>
                <Input
                  id="add-member-birth-date"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-member-address">Alamat</Label>
              <Input
                id="add-member-address"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-member-nik">NIK</Label>
              <Input
                id="add-member-nik"
                inputMode="numeric"
                maxLength={16}
                placeholder="16 digit (opsional)"
                value={form.nik}
                onChange={(e) =>
                  setField("nik", e.target.value.replace(/\D/g, "").slice(0, 16))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-member-phone">Telepon</Label>
              <Input
                id="add-member-phone"
                inputMode="tel"
                placeholder="Opsional"
                value={form.phoneNumber}
                onChange={(e) => setField("phoneNumber", e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Sabuk
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="add-member-rank">Kyu saat ini (Kyu Lama)</Label>
              <select
                id="add-member-rank"
                className="h-9 w-full rounded-lg border px-2 text-sm"
                value={form.currentRank}
                onChange={(e) => setField("currentRank", e.target.value)}
              >
                {BELT_RANK_OPTIONS.map((rank) => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
            </div>
          </section>

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
