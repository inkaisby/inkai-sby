"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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

export type LatberGuestDojoOption = { id: string; name: string };

type SoftDup = {
  id: string;
  fullName: string;
  nia?: string | null;
  dojoName?: string | null;
};

type LatberAddGuestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  dojos: LatberGuestDojoOption[];
  defaultDojoId?: string;
  lockDojo?: boolean;
  apiPath: string;
  onRegistered?: (result: {
    memberId: string;
    registrationId: string;
    memberName: string;
  }) => void;
  onRegisterExisting?: (memberId: string) => void;
};

export function LatberAddGuestDialog({
  open,
  onOpenChange,
  eventId,
  dojos,
  defaultDojoId = "",
  lockDojo = false,
  apiPath,
  onRegistered,
  onRegisterExisting,
}: LatberAddGuestDialogProps) {
  const [fullName, setFullName] = useState("");
  const [dojoId, setDojoId] = useState(defaultDojoId);
  const [currentRank, setCurrentRank] = useState(DEFAULT_MEMBER_RANK);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [softDuplicates, setSoftDuplicates] = useState<SoftDup[]>([]);

  useEffect(() => {
    if (!open) return;
    setFullName("");
    setDojoId(defaultDojoId || (dojos.length === 1 ? dojos[0].id : ""));
    setCurrentRank(DEFAULT_MEMBER_RANK);
    setPhoneNumber("");
    setSoftDuplicates([]);
  }, [open, defaultDojoId, dojos]);

  async function submit(confirmSoftDuplicate: boolean) {
    const name = fullName.trim().toUpperCase();
    if (name.length < 2) {
      showError("Nama lengkap wajib diisi");
      return;
    }
    const resolvedDojo = dojoId || defaultDojoId;
    if (!resolvedDojo) {
      showError("Pilih ranting");
      return;
    }
    if (phoneNumber.trim() && phoneNumber.trim().length < 10) {
      showError("Nomor telepon tidak valid");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          fullName: name,
          dojoId: resolvedDojo,
          currentRank: currentRank || DEFAULT_MEMBER_RANK,
          phoneNumber: phoneNumber.trim() || undefined,
          confirmSoftDuplicate: confirmSoftDuplicate || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        softDuplicates?: SoftDup[];
        memberId?: string;
        registrationId?: string;
        memberName?: string;
      };
      if (res.status === 409 && data.code === "SOFT_DUPLICATE") {
        setSoftDuplicates(data.softDuplicates ?? []);
        showError(data.error || "Nama mirip anggota yang sudah ada");
        return;
      }
      if (!res.ok) {
        showError(data.error || "Gagal mendaftarkan peserta");
        return;
      }
      showSuccess(`${data.memberName || name} terdaftar di Latber`);
      onOpenChange(false);
      if (data.memberId && data.registrationId) {
        onRegistered?.({
          memberId: data.memberId,
          registrationId: data.registrationId,
          memberName: data.memberName || name,
        });
      }
    } catch {
      showError("Gagal mendaftarkan peserta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Peserta</DialogTitle>
          <DialogDescription>
            Daftar cepat di luar keanggotaan (nama + ranting). Status{" "}
            <strong>Belum Bayar</strong>. Lengkapi keanggotaan nanti dari admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="latber-guest-name">Nama lengkap</Label>
            <Input
              id="latber-guest-name"
              className="uppercase"
              value={fullName}
              onChange={(e) => setFullName(e.target.value.toUpperCase())}
              placeholder="NAMA PESERTA"
              autoFocus
            />
          </div>

          {!lockDojo ? (
            <div className="space-y-1.5">
              <Label htmlFor="latber-guest-dojo">Ranting</Label>
              <select
                id="latber-guest-dojo"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={dojoId}
                onChange={(e) => setDojoId(e.target.value)}
              >
                <option value="">Pilih ranting</option>
                {dojos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ranting:{" "}
              <strong>
                {dojos.find((d) => d.id === (dojoId || defaultDojoId))?.name ||
                  "—"}
              </strong>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="latber-guest-rank">Sabuk (opsional)</Label>
            <select
              id="latber-guest-rank"
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={currentRank}
              onChange={(e) => setCurrentRank(e.target.value)}
            >
              {BELT_RANK_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="latber-guest-phone">No. HP (opsional)</Label>
            <Input
              id="latber-guest-phone"
              inputMode="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="08…"
            />
          </div>

          {softDuplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Nama mirip anggota yang sudah ada
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {softDuplicates.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      {d.fullName}
                      {d.nia ? ` · ${d.nia}` : ""}
                      {d.dojoName ? ` · ${d.dojoName}` : ""}
                    </span>
                    {onRegisterExisting ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={loading}
                        onClick={() => {
                          onOpenChange(false);
                          onRegisterExisting(d.id);
                        }}
                      >
                        Daftar anggota ini
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                size="sm"
                className="mt-3 bg-inkai-red text-white hover:bg-inkai-red/90"
                disabled={loading}
                onClick={() => void submit(true)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Menyimpan…
                  </>
                ) : (
                  "Lanjut buat peserta baru"
                )}
              </Button>
            </div>
          ) : null}
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
            disabled={loading || softDuplicates.length > 0}
            onClick={() => void submit(false)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              "Simpan & Daftar Latber"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
